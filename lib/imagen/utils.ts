import ky from "ky";
import sharp from "sharp";
import type { BoundingBox } from "./types";

const DEFAULT_COLORS = [
	"#ef4444",
	"#f97316",
	"#f59e0b",
	"#84cc16",
	"#22c55e",
	"#14b8a6",
	"#06b6d4",
	"#3b82f6",
	"#6366f1",
	"#8b5cf6",
	"#a855f7",
	"#ec4899",
	"#f43f5e",
];

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

const escapeForSvg = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const blobToBuffer = async (blob: Blob) =>
	Buffer.from(await blob.arrayBuffer());

/**
 * URLからBlobに変換
 */
export async function fetchAsBlob(url: string): Promise<Blob> {
	const response = await ky.get(url);

	return await response.blob();
}

export async function blobToBase64(blob: Blob): Promise<string> {
	const arrayBuffer = await blob.arrayBuffer();
	return Buffer.from(arrayBuffer).toString("base64");
}

const toAbsoluteBox = (
	box: BoundingBox["box_2d"],
	width: number,
	height: number,
) => {
	const [yMin, xMin, yMax, xMax] = box;
	const rawYMin = (yMin / 1000) * height;
	const rawXMin = (xMin / 1000) * width;
	const rawYMax = (yMax / 1000) * height;
	const rawXMax = (xMax / 1000) * width;

	const absYMin = clamp(Math.round(Math.min(rawYMin, rawYMax)), 0, height);
	const absXMin = clamp(Math.round(Math.min(rawXMin, rawXMax)), 0, width);
	const absYMax = clamp(Math.round(Math.max(rawYMin, rawYMax)), 0, height);
	const absXMax = clamp(Math.round(Math.max(rawXMin, rawXMax)), 0, width);

	return { absYMin, absXMin, absYMax, absXMax };
};

const svgOverlay = (
	width: number,
	height: number,
	boundingBoxes: BoundingBox[],
) => {
	const elements = boundingBoxes.map((bbox, index) => {
		const { absYMin, absXMin, absYMax, absXMax } = toAbsoluteBox(
			bbox.box_2d,
			width,
			height,
		);
		const color = DEFAULT_COLORS[index % DEFAULT_COLORS.length];
		const rectWidth = Math.max(1, absXMax - absXMin);
		const rectHeight = Math.max(1, absYMax - absYMin);
		const label = bbox.label?.trim();

		const rect = `<rect x="${absXMin}" y="${absYMin}" width="${rectWidth}" height="${rectHeight}" fill="none" stroke="${color}" stroke-width="4" />`;
		if (!label) {
			return rect;
		}

		const text = `<text x="${absXMin + 8}" y="${absYMin + 6}" fill="${color}" font-size="20" font-family="sans-serif" font-weight="700">${escapeForSvg(label)}</text>`;
		return `${rect}${text}`;
	});

	return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join("")}</svg>`;
};

export async function plotBoundingBoxes(
	imageBlob: Blob,
	boundingBoxes: BoundingBox[],
) {
	const inputBuffer = await blobToBuffer(imageBlob);
	const image = sharp(inputBuffer);
	const metadata = await image.metadata();

	if (!metadata.width || !metadata.height) {
		throw new Error("Failed to read image dimensions");
	}

	const overlay = svgOverlay(metadata.width, metadata.height, boundingBoxes);
	const outputBuffer = await image
		.composite([{ input: Buffer.from(overlay) }])
		.png()
		.toBuffer();

	return new Blob([new Uint8Array(outputBuffer)], { type: "image/png" });
}

export async function cropBoundingBoxes(
	imageBlob: Blob,
	boundingBoxes: BoundingBox[],
) {
	const inputBuffer = await blobToBuffer(imageBlob);
	const image = sharp(inputBuffer);
	const metadata = await image.metadata();

	if (!metadata.width || !metadata.height) {
		throw new Error("Failed to read image dimensions");
	}

	const crops = await Promise.all(
		boundingBoxes.map(async (bbox) => {
			const { absYMin, absXMin, absYMax, absXMax } = toAbsoluteBox(
				bbox.box_2d,
				metadata.width ?? 0,
				metadata.height ?? 0,
			);

			const cropWidth = Math.max(1, absXMax - absXMin);
			const cropHeight = Math.max(1, absYMax - absYMin);

			const outputBuffer = await sharp(inputBuffer)
				.extract({
					left: absXMin,
					top: absYMin,
					width: cropWidth,
					height: cropHeight,
				})
				.png()
				.toBuffer();

			return new Blob([new Uint8Array(outputBuffer)], {
				type: "image/png",
			});
		}),
	);

	return crops;
}
