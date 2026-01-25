import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ObjectDetection } from "../lib/object-detection/client";

async function main() {
	const args = process.argv.slice(2);
	const imageUrl = args[0] || "https://i.imgur.com/sAPwEw0.png";
	const prompt = args[1] || "floor plan";
	const outputPath =
		args[2] || path.resolve(process.cwd(), "object-detection-output.png");

	console.log("=== Object Detection Test ===");
	console.log(`Image URL: ${imageUrl}`);
	console.log(`Detection Prompt: ${prompt}`);
	console.log(`Output Path: ${outputPath}`);

	const detector = new ObjectDetection();

	try {
		console.log("\nDetecting objects...");
		const result = await detector.detectObjects({
			image_url: imageUrl,
			prompt,
			return_multiple_masks: true,
			include_scores: true,
			include_boxes: true,
		});
		console.log("\nDetection result:", result);

		const maskCount = result.masks.length ?? 0;
		console.log(`\nMasks returned: ${maskCount}`);

		if (result.boxes?.length) {
			console.log("\nBounding boxes (cx, cy, w, h):");
			for (const box of result.boxes) {
				console.log(`  - ${JSON.stringify(box)}`);
			}
		}

		const previewUrl = result.image?.url ?? result.masks[0]?.url;
		if (!previewUrl) {
			throw new Error("No preview image URL returned from SAM-3.");
		}

		console.log(`\nDownloading preview image: ${previewUrl}`);
		const previewResponse = await fetch(previewUrl);
		if (!previewResponse.ok) {
			throw new Error(
				`Failed to fetch preview image: ${previewResponse.statusText}`,
			);
		}
		const previewBuffer = Buffer.from(await previewResponse.arrayBuffer());
		await writeFile(outputPath, previewBuffer);

		console.log("\n✅ Detection completed successfully!");
		console.log(`Saved preview image to: ${outputPath}`);
	} catch (error) {
		console.error("\n❌ Error detecting objects:", error);
	}
}

main();
