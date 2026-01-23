import { writeFile } from "node:fs/promises";
import path from "node:path";
import { HazardMapGenerator } from "../lib/hazard-map";

async function main() {
	const args = process.argv.slice(2);
	const address = args[0] || "東京都港区芝公園4-2-8";
	const outputPath =
		args[1] || path.resolve(process.cwd(), "hazard-map-output.png");

	console.log("=== Hazard Map Image Generation Test ===");
	console.log(`Target Address: ${address}`);
	console.log(`Output Path: ${outputPath}`);

	const generator = new HazardMapGenerator();

	try {
		console.log("\nGenerating high-res map...");
		const buffer = await generator.generate({
			center: address,
			size: "900x675", // 4:3比率、スライドの半分サイズ
			scale: 2, // 2倍解像度 = 1800x1350ピクセル
			zoom: 14, // 元に戻す
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
