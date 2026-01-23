/**
 * 周辺相場比較（fetchNearbyTransactions）のテストスクリプト
 *
 * 実行方法:
 * npx tsx scripts/test-price-analysis.ts "東京都港区六本木1-1-1"
 */

import "dotenv/config";
import { fetchNearbyTransactions } from "../lib/slide-generator/tools/reinfo";

async function main() {
	const apiKey = process.env.REINFO_API_KEY;
	if (!apiKey) {
		console.error(
			"❌ REINFO_API_KEY が未設定です。環境変数に設定してください。",
		);
		process.exit(1);
	}

	// コマンドライン引数から住所を取得（デフォルト: 東京都港区六本木）
	const address = process.argv[2] ?? "東京都港区六本木1-1-1";

	// オプションパラメータ
	const zoom = Number(process.argv[3] ?? "14");
	const yearsBack = Number(process.argv[4] ?? "5");
	const maxResults = Number(process.argv[5] ?? "6");

	console.log("\n=== 周辺相場比較APIテスト ===");
	console.log(`📍 住所: ${address}`);
	console.log(`🔍 検索範囲: zoom=${zoom}`);
	console.log(`📅 期間: 過去${yearsBack}年`);
	console.log(`📊 最大件数: ${maxResults}件\n`);

	try {
		// 対象物件のサンプルデータ（オプション）
		const targetPropertyInput = {
			name: "テスト物件",
			price: "5,800万円",
			area: "72.5㎡",
			constructionYear: "1998年",
		};

		console.log("🏠 対象物件データ:");
		console.log(`  - 物件名: ${targetPropertyInput.name}`);
		console.log(`  - 価格: ${targetPropertyInput.price}`);
		console.log(`  - 面積: ${targetPropertyInput.area}`);
		console.log(`  - 築年: ${targetPropertyInput.constructionYear}\n`);

		console.log("⏳ API呼び出し中...\n");

		const result = await fetchNearbyTransactions(address, {
			zoom,
			yearsBack,
			maxResults,
			targetPropertyInput,
		});

		console.log("✅ API呼び出し成功！\n");

		// 対象物件の表示
		if (result.targetProperty) {
			console.log("🎯 【対象物件】");
			console.log(`  物件名: ${result.targetProperty.name}`);
			console.log(`  築年数: ${result.targetProperty.age}年`);
			console.log(`  面積: ${result.targetProperty.area}`);
			console.log(`  価格: ${result.targetProperty.price}`);
			console.log(`  坪単価: ${result.targetProperty.unitPrice}万円\n`);
		}

		// 推定価格範囲
		console.log("💰 【推定価格範囲】");
		console.log(
			`  ${result.estimatedPriceMin} ～ ${result.estimatedPriceMax}万円`,
		);
		console.log(`  平均坪単価: ${result.averageUnitPrice}万円\n`);

		// 類似物件リスト
		console.log(
			`📋 【類似物件】 (${result.similarProperties.length}件 / 全${result.dataCount}件)`,
		);
		console.log("─".repeat(80));
		console.log(
			`${"物件名".padEnd(30)} ${"築年数".padStart(8)} ${"面積".padStart(10)} ${"価格".padStart(12)} ${"坪単価".padStart(10)}`,
		);
		console.log("─".repeat(80));

		for (const prop of result.similarProperties) {
			console.log(
				`${prop.name.padEnd(30)} ${(prop.age + "年").padStart(8)} ${prop.area.padStart(10)} ${(prop.price + "万円").padStart(12)} ${(prop.unitPrice + "万円").padStart(10)}`,
			);
		}
		console.log("─".repeat(80));

		console.log("\n✨ テスト完了\n");
	} catch (error) {
		console.error("\n❌ エラーが発生しました:");
		if (error instanceof Error) {
			console.error(`  メッセージ: ${error.message}`);
			console.error(`  スタック: ${error.stack}`);
		} else {
			console.error(error);
		}
		process.exit(1);
	}
}

main();
