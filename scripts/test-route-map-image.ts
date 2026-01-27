/**
 * 路線図マップ画像生成テストスクリプト
 *
 * 使用方法:
 *   bun scripts/test-route-map-image.ts
 */

import type { RouteMapImageResult } from "../lib/slide-generator/tools/route-map-image";
import { generateRouteMapImageTool } from "../lib/slide-generator/tools/route-map-image";

async function main() {
	console.log("=== 路線図マップ画像生成テスト ===\n");

	const testCases = [
		{
			address: "東京都港区白金台3-16",
			nearestStationName: "白金台",
			walkMinutes: 5,
		},
		{
			address: "東京都世田谷区太子堂4-1",
			nearestStationName: "三軒茶屋",
			walkMinutes: 3,
		},
	];

	// ツールのexecute関数を取得
	const execute = generateRouteMapImageTool.execute;
	if (!execute) {
		throw new Error("Tool execute function not found");
	}

	for (const testCase of testCases) {
		console.log(`\n📍 テスト: ${testCase.address}`);
		console.log(
			`   最寄り駅: ${testCase.nearestStationName} (徒歩${testCase.walkMinutes}分)`,
		);
		console.log("-".repeat(50));

		try {
			// execute関数を直接呼び出し（第2引数にToolExecutionOptionsを渡す）
			const result = (await execute(testCase, {
				toolCallId: "test-call",
				messages: [],
				abortSignal: undefined as unknown as AbortSignal,
			})) as RouteMapImageResult;

			// 結果を表示
			console.log(`\n🚉 最寄り駅: ${result.routeMapData.nearestStation.name}`);
			console.log(
				`   路線: ${result.routeMapData.nearestStation.lines.join("、")}`,
			);

			console.log(`\n🏢 主要ターミナル駅へ（所要時間順TOP3）:`);
			const sortedStations = [...result.routeMapData.stationRoutes]
				.sort((a, b) => a.totalMinutes - b.totalMinutes)
				.slice(0, 3);
			sortedStations.forEach((route, i) => {
				console.log(
					`   ${i + 1}. ${route.destination}: ${route.totalMinutes}分 (${route.routeSummary})`,
				);
			});

			console.log(`\n✈️ 空港へのアクセス:`);
			result.routeMapData.airportRoutes.forEach((route) => {
				console.log(
					`   ${route.destination}: ${route.totalMinutes}分 (${route.routeSummary})`,
				);
			});

			// 画像URLを表示（S3にアップロード済み）
			if (result.mapImageUrl) {
				console.log(`\n🖼️ 画像URL: ${result.mapImageUrl}`);
			}

			console.log("\n✅ テスト成功");
		} catch (error) {
			console.error(`\n❌ エラー: ${error}`);
		}
	}

	console.log("\n=== テスト完了 ===");
}

main().catch(console.error);
