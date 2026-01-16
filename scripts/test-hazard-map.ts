import { writeFile } from "node:fs/promises";
import path from "node:path";
import { HazardMapGenerator } from "../lib/hazard-map";

async function main() {
	const args = process.argv.slice(2);
	const address = args[0] || "東京都千代田区千代田１−１";
	const outputPath =
		args[1] || path.resolve(process.cwd(), "hazard-map-output.png");

	console.log("=== Hazard Map Image Generation Test ===");
	console.log(`Target Address: ${address}`);
	console.log(`Output Path: ${outputPath}`);

	const generator = new HazardMapGenerator();

	try {
		console.log("\nGenerating map...");
		const buffer = await generator.generate({
			center: address,
			size: "800x600",
			zoom: 14, // 少し詳細に
			hazardTypes: ["flood_l2", "dosekiryu", "kyukeisha", "jisuberi"], // 全部乗せ
			opacity: 0.7,
		});

		await writeFile(outputPath, buffer);

		console.log("\n✅ Image generated successfully!");
		console.log(`Saved to: ${outputPath}`);
	} catch (error) {
		console.error("\n❌ Error generating map:", error);
	}
}

main();
