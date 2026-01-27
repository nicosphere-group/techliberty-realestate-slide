/**
 * HeartRails Express API テストスクリプト
 *
 * 使用方法:
 *   bun scripts/test-heartrails.ts
 */

import { heartRailsClient } from "../lib/heartrails/client";

async function main() {
	console.log("=== HeartRails Express API テスト ===\n");

	const testLocations = [
		{ name: "白金台", lat: 35.6389, lng: 139.7274 },
		{ name: "三軒茶屋", lat: 35.6438, lng: 139.6698 },
		{ name: "八王子", lat: 35.6559, lng: 139.3389 },
	];

	for (const location of testLocations) {
		console.log(
			`\n📍 テスト: ${location.name} (${location.lat}, ${location.lng})`,
		);
		console.log("-".repeat(50));

		const stations = await heartRailsClient.getNearestStations(
			location.lat,
			location.lng,
		);

		if (stations.length === 0) {
			console.log("   最寄り駅が見つかりませんでした");
			continue;
		}

		console.log(`\n🚉 最寄り駅一覧:`);
		stations.forEach((station, i) => {
			console.log(
				`   ${i + 1}. ${station.name} (徒歩${station.walkMinutes}分, ${station.distanceMeters}m)`,
			);
			console.log(`      路線: ${station.lines.join("・")}`);
		});
	}

	console.log("\n=== テスト完了 ===");
}

main().catch(console.error);
