import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ObjectDetection } from "../lib/object-detection/client";

async function main() {
	const args = process.argv.slice(2);
	const imageUrl = args[0] || "https://i.imgur.com/sAPwEw0.png";
	const prompt = args[1] || "Detect all the floor plans in this image";
	const outputPath =
		args[2] || path.resolve(process.cwd(), "object-detection-output.png");

	console.log("=== Object Detection Test ===");
	console.log(`Image URL: ${imageUrl}`);
	console.log(`Detection Prompt: ${prompt}`);
	console.log(`Output Path: ${outputPath}`);

	const detector = new ObjectDetection();

	try {
		console.log("\nFetching image...");
		const response = await fetch(imageUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch image: ${response.statusText}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		const imageFile = new File([arrayBuffer], "sample.png", {
			type: "image/png",
		});

		console.log("\nDetecting objects...");
		const result = await detector.detectObjects(imageFile, prompt);

		console.log("\nBounding boxes:");
		for (const box of result.boundingBoxes) {
			console.log(`  - ${JSON.stringify(box)}`);
		}

		await writeFile(outputPath, result.annotatedImageBuffer);

		console.log("\n✅ Detection completed successfully!");
		console.log(`Saved annotated image to: ${outputPath}`);
	} catch (error) {
		console.error("\n❌ Error detecting objects:", error);
	}
}

main();
