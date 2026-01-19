import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ShelterMapGenerator } from "../lib/shelter-map";

async function main() {
	const args = process.argv.slice(2);
	const address = args[0] || "東京都千代田区千代田１−１";
	const outputPath =
		args[1] || path.resolve(process.cwd(), "shelter-map-output.png");

	console.log("=== Shelter Map Image Generation Test ===");
	console.log(`Target Address: ${address}`);
	console.log(`Output Path: ${outputPath}`);

	const generator = new ShelterMapGenerator();

	try {
		// まず避難所データのみを取得してみる
		console.log("\nFetching shelter data...");
		const shelters = await generator.getShelters(address, 14);
		console.log(`Found ${shelters.length} shelters nearby`);

		if (shelters.length > 0) {
			console.log("\nSample shelter data:");
			for (const shelter of shelters.slice(0, 3)) {
				console.log("  -", JSON.stringify(shelter.properties, null, 2));
			}
		}

		// 地図画像を生成
		console.log("\nGenerating map with shelters...");
		const buffer = await generator.generate({
			center: address,
			size: "800x600",
			zoom: 14,
			showHazardMap: false, // ハザードマップなし
		});

		await writeFile(outputPath, buffer);
		console.log("\n✅ Image generated successfully!");
		console.log(`Saved to: ${outputPath}`);
	} catch (error) {
		console.error("\n❌ Error:", error);
	}
}

main();
