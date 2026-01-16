import { CSISGeocoder } from "../lib/geocode";

/**
 * 緯度・経度・ズームレベルからXYZタイル座標を計算する
 * (slide-generator.ts の get_hazard_map_tile_xyz と同等のロジック)
 */
function getTileXYZ(latitude: number, longitude: number, zoom: number) {
	const latRad = (latitude * Math.PI) / 180;
	const n = 2 ** zoom;
	const x = Math.floor((n * (longitude + 180)) / 360);
	const y = Math.floor(
		(n * (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2,
	);

	return { x, y, z: zoom };
}

/**
 * XYZタイル座標からハザードマップURLを生成する
 * (slide-generator.ts の get_hazard_map_urls と同等のロジック)
 */
function getHazardMapUrls(x: number, y: number, z: number) {
	const baseUrl = "https://disaportaldata.gsi.go.jp/raster";
	return {
		flood_l2: `${baseUrl}/01_flood_l2_shinsuishin_data/${z}/${x}/${y}.png`, // 洪水（想定最大規模）
		high_tide: `${baseUrl}/03_hightide_l2_shinsuishin_data/${z}/${x}/${y}.png`, // 高潮
		tsunami: `${baseUrl}/04_tsunami_newlegend_data/${z}/${x}/${y}.png`, // 津波
		dosekiryu: `${baseUrl}/05_dosekiryukeikaikuiki/${z}/${x}/${y}.png`, // 土石流
		kyukeisha: `${baseUrl}/05_kyukeishakeikaikuiki/${z}/${x}/${y}.png`, // 急傾斜地
		jisuberi: `${baseUrl}/05_jisuberikeikaikuiki/${z}/${x}/${y}.png`, // 地すべり
	};
}

async function main() {
	// テストする住所 (コマンドライン引数があればそれを使用、なければデフォルト)
	const address = process.argv[2] || "東京都千代田区千代田1-1";
	const zoom = 15;

	console.log(`\n=== ハザードマップURL生成テスト ===`);
	console.log(`Target Address: ${address}`);
	console.log(`Zoom Level: ${zoom}`);

	try {
		// 1. ジオコーディング
		console.log("\n1. Running Geocoding...");
		const geocoder = new CSISGeocoder();
		const results = await geocoder.geocode(address);

		if (!results.length) {
			console.error("Error: Failed to geocode address.");
			return;
		}

		const latitude = results[0].coordinates.latitude;
		const longitude = results[0].coordinates.longitude;

		console.log(`   Latitude:  ${latitude}`);
		console.log(`   Longitude: ${longitude}`);

		// 2. XYZ座標計算
		console.log("\n2. Calculating Tile XYZ...");
		const tile = getTileXYZ(latitude, longitude, zoom);
		console.log(`   X: ${tile.x}`);
		console.log(`   Y: ${tile.y}`);
		console.log(`   Z: ${tile.z}`);

		// 3. URL生成
		console.log("\n3. Generating Hazard Map URLs...");
		const urls = getHazardMapUrls(tile.x, tile.y, tile.z);

		console.log("   Generated URLs:");
		Object.entries(urls).forEach(([key, url]) => {
			console.log(`   - [${key}]: ${url}`);
		});

		console.log("\n=== Test Complete ===");
	} catch (error) {
		console.error("\nAn error occurred:", error);
	}
}

main();
