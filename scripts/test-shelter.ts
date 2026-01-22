import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ShelterMapGenerator } from "../lib/shelter-map";

async function main() {
	const args = process.argv.slice(2);
	const address = args[0] || "東京都港区芝公園4-2-8";
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

		// 最寄り3箇所の避難所を取得
		console.log("\nGetting nearest 3 shelters...");
		const nearestShelters = await generator.getNearestShelters(address, 14, 3);
		console.log("\nNearest shelters:");
		for (const shelter of nearestShelters) {
			console.log(
				`  - ${shelter.properties.facility_name_ja} (徒歩${shelter.walkingMinutes}分, 距離: ${Math.round(shelter.distance)}m)`,
			);
		}

		// 地図画像を生成（最寄り3箇所の避難所を表示）
		console.log("\nGenerating map with nearest 3 shelters...");
		const buffer = await generator.generate({
			center: address,
			size: "900x675", // ハザードマップと同じサイズ
			scale: 2, // ハザードマップと同じscale
			zoom: 17, // より拡大して近くで表示
			showHazardMap: false, // ハザードマップなし
			maxShelters: 3, // 最寄り3箇所
		});

		await writeFile(outputPath, buffer);
		console.log("\n✅ Image generated successfully!");
		console.log(`Saved to: ${outputPath}`);
	} catch (error) {
		console.error("\n❌ Error:", error);
	}
}

main();
