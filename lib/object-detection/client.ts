import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { generateText, Output } from "ai";
import Mustache from "mustache";
import sharp from "sharp";
import type { z } from "zod";
import { boundingBoxesSchema } from "./schemas";


type BoundingBoxes = z.infer<typeof boundingBoxesSchema>;

const OBJECT_DETECTION_PROMPT = `
You are an AI assistant specialized in object detection and drawing accurate bounding boxes. Your task is to generate normalized coordinates for bounding boxes based on given instructions and an image.
The coordinates for the bounding boxes should be normalized relative to the width and height of the image. This means:
- The top-left corner of the image is (0, 0)
- The bottom-right corner of the image is (1, 1)
- X-coordinates increase from left to right
- Y-coordinates increase from top to bottom
Now, here are the specific instructions for object detection:
<instructions>
{{{USER_INSTRUCTIONS}}}
</instructions>
Your output should be in the following format:
<bounding_box>
  <object>Name of the object</object>
  <coordinates>
    <top_left>(x1, y1)</top_left>
    <bottom_right>(x2, y2)</bottom_right>
  </coordinates>
</bounding_box>
If there are multiple objects to detect, provide separate <bounding_box> entries for each object. Focus on identifying the coordinates for one object before moving on to the next.
Here's an example of a good output:
<bounding_box>
  <object>Cat</object>
  <coordinates>
    <top_left>(0.2, 0.3)</top_left>
    <bottom_right>(0.5, 0.7)</bottom_right>
  </coordinates>
</bounding_box>
<bounding_box>
  <object>Dog</object>
  <coordinates>
    <top_left>(0.6, 0.4)</top_left>
    <bottom_right>(0.9, 0.8)</bottom_right>
  </coordinates>
</bounding_box>
If you cannot detect an object mentioned in the instructions, or if the instructions are unclear, include an explanation in your response:
<error>Unable to detect [object name] because [reason]</error>
Remember to be as accurate as possible when determining the coordinates. If you're unsure about the exact position of an object, use your best judgment to provide the most reasonable estimate.
Begin your object detection and bounding box coordinate generation now, based on the provided image and instructions.
`;

export class ObjectDetection {
	private readonly visionModel: LanguageModel = google(
		"gemini-3-flash-preview",
	);
	private readonly model: LanguageModel = google("gemini-2.5-flash-lite");

	async generateBoundingBoxes(imageFile: File, userQuery: string) {
		const promptWithInstructions = Mustache.render(OBJECT_DETECTION_PROMPT, {
			USER_INSTRUCTIONS: userQuery,
		});

		const { text: semiStructuredResponse } = await generateText({
			model: this.visionModel,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "image",
							image: await imageFile.arrayBuffer(),
						},
						{
							type: "text",
							text: promptWithInstructions,
						},
					],
				},
			],
		});

		const { output: boundingBoxes } = await generateText({
			model: this.model,
			messages: [
				{
					role: "user",
					content: `What are the coordinates of all bounding boxes: ${semiStructuredResponse}`,
				},
			],
			output: Output.object({
				name: "boundingBoxes",
				description: "Detected bounding boxes with normalized coordinates",
				schema: boundingBoxesSchema,
			}),
		});

		return boundingBoxes;
	}

	async drawBoundingBoxes(params: {
		imageFile: File;
		boundingBoxes: BoundingBoxes;
		boxThickness?: number;
		labelSize?: number;
	}): Promise<Buffer> {
		const {
			imageFile,
			boundingBoxes,
			boxThickness = 8,
			labelSize = 1.0,
		} = params;

		const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
		const baseImage = sharp(imageBuffer);
		const metadata = await baseImage.metadata();
		const width = metadata.width ?? 0;
		const height = metadata.height ?? 0;
		if (!width || !height) {
			throw new Error("Unable to determine image dimensions");
		}

		const fontSize = Math.max(10, Math.round(16 * labelSize));
		const padding = 6;

		const svgElements = boundingBoxes
			.map((box) => {
				const color = {
					r: Math.floor(Math.random() * 256),
					g: Math.floor(Math.random() * 256),
					b: Math.floor(Math.random() * 256),
				};
				const stroke = `rgb(${color.r},${color.g},${color.b})`;

				const x1 = this.clamp(box.x1, 0, 1);
				const y1 = this.clamp(box.y1, 0, 1);
				const x2 = this.clamp(box.x2, 0, 1);
				const y2 = this.clamp(box.y2, 0, 1);

				const startX = Math.round(x1 * width);
				const startY = Math.round(y1 * height);
				const endX = Math.round(x2 * width);
				const endY = Math.round(y2 * height);
				const rectWidth = Math.max(1, endX - startX);
				const rectHeight = Math.max(1, endY - startY);

				const label = box.objectName ?? "";
				const labelLength = [...label].length;
				const textWidth = Math.max(1, Math.ceil(fontSize * 0.6 * labelLength));
				const bgWidth = textWidth + padding * 2;
				const bgHeight = fontSize + padding * 2;

				const rawLabelX = startX;
				const rawLabelY = startY - bgHeight - 4;
				const labelX = this.clamp(rawLabelX, 0, width - bgWidth);
				const labelY = this.clamp(rawLabelY, 0, height - bgHeight);

				const textX = labelX + padding;
				const textY = labelY + padding;

				return [
					`<rect x="${startX}" y="${startY}" width="${rectWidth}" height="${rectHeight}" fill="none" stroke="${stroke}" stroke-width="${boxThickness}" />`,
					`<rect x="${labelX}" y="${labelY}" width="${bgWidth}" height="${bgHeight}" fill="${stroke}" />`,
					`<text x="${textX}" y="${textY}" font-size="${fontSize}" font-family="sans-serif" fill="#000000" dominant-baseline="hanging">${this.escapeXml(label)}</text>`,
				].join("");
			})
			.join("");

		const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`;

		return await baseImage
			.composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
			.png()
			.toBuffer();
	}

	private clamp(value: number, min: number, max: number) {
		return Math.min(max, Math.max(min, value));
	}

	private escapeXml(value: string) {
		return value
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&apos;");
	}

	async detectObjects(imageFile: File, userQuery: string) {
		const boundingBoxes = await this.generateBoundingBoxes(
			imageFile,
			userQuery,
		);
		const annotatedImageBuffer = await this.drawBoundingBoxes({
			imageFile,
			boundingBoxes,
		});
		return {
			boundingBoxes,
			annotatedImageBuffer,
		};
	}
}
