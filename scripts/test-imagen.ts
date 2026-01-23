/**
 * Imagen Client テストスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/test-imagen.ts [test-type]
 *
 * test-type:
 *   property - 物件画像抽出テスト
 *   floorplan - 間取り図抽出テスト
 *   routemap - 路線図生成テスト（手動データ）
 *   routemap-address - 路線図生成テスト（住所から自動取得）
 *   all - すべてのテスト（デフォルト）
 *
 * 環境変数:
 *   TEST_MAISOKU_URL - マイソク画像URL（property, floorplanテスト用）
 *   TEST_ADDRESS - テスト用住所（routemap-addressテスト用、デフォルト: 東京都渋谷区恵比寿1-1-1）
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// .env ファイルを手動で読み込む
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
	const envContent = readFileSync(envPath, "utf-8");
	for (const line of envContent.split("\n")) {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith("#")) {
			const [key, ...valueParts] = trimmed.split("=");
			const value = valueParts.join("=").replace(/^["']|["']$/g, "");
			if (key && !process.env[key]) {
				process.env[key] = value;
			}
		}
	}
}

import { RealEstateImagenClient } from "../lib/imagen";

// テスト用のサンプルマイソク画像URL（公開されているサンプル画像を使用）
// 実際のテスト時は有効なマイソク画像URLに置き換えてください
const SAMPLE_MAISOKU_URL = process.env.TEST_MAISOKU_URL || "";

async function testPropertyImage(client: RealEstateImagenClient) {
	console.log("\n=== 物件画像抽出テスト ===");

	if (!SAMPLE_MAISOKU_URL) {
		console.log(
			"TEST_MAISOKU_URL 環境変数が設定されていません。スキップします。",
		);
		return;
	}

	console.log(`マイソク画像URL: ${SAMPLE_MAISOKU_URL}`);

	const result = await client.extractPropertyImage({
		maisokuImageUrl: SAMPLE_MAISOKU_URL,
	});

	if (result.error) {
		console.error(`エラー: ${result.error}`);
		return;
	}

	if (result.image) {
		const timestamp = Date.now();

		// クロップ画像を保存（中間結果）
		if (result.intermediateImage) {
			const croppedFilename = `test-property-cropped-${timestamp}.png`;
			writeFileSync(croppedFilename, result.intermediateImage.imageData);
			console.log(`クロップ画像を保存しました: ${croppedFilename}`);
			console.log(
				`  - サイズ: ${result.intermediateImage.imageData.length} bytes`,
			);
		}

		// 最終生成画像を保存
		const filename = `test-property-image-${timestamp}.png`;
		writeFileSync(filename, result.image.imageData);
		console.log(`成功! 最終画像を保存しました: ${filename}`);
		console.log(`  - アスペクト比: ${result.image.aspectRatio}`);
		console.log(`  - MIMEタイプ: ${result.image.mimeType}`);
		console.log(`  - サイズ: ${result.image.imageData.length} bytes`);
	}
}

async function testFloorPlanImage(client: RealEstateImagenClient) {
	console.log("\n=== 間取り図抽出テスト ===");

	if (!SAMPLE_MAISOKU_URL) {
		console.log(
			"TEST_MAISOKU_URL 環境変数が設定されていません。スキップします。",
		);
		return;
	}

	console.log(`マイソク画像URL: ${SAMPLE_MAISOKU_URL}`);

	const result = await client.extractFloorPlanImage({
		maisokuImageUrl: SAMPLE_MAISOKU_URL,
	});

	if (result.error) {
		console.error(`エラー: ${result.error}`);
		return;
	}

	if (result.image) {
		const timestamp = Date.now();

		// クロップ画像を保存（中間結果）
		if (result.intermediateImage) {
			const croppedFilename = `test-floorplan-cropped-${timestamp}.png`;
			writeFileSync(croppedFilename, result.intermediateImage.imageData);
			console.log(`クロップ画像を保存しました: ${croppedFilename}`);
			console.log(
				`  - サイズ: ${result.intermediateImage.imageData.length} bytes`,
			);
		}

		// 最終生成画像を保存
		const filename = `test-floorplan-image-${timestamp}.png`;
		writeFileSync(filename, result.image.imageData);
		console.log(`成功! 最終画像を保存しました: ${filename}`);
		console.log(`  - アスペクト比: ${result.image.aspectRatio}`);
		console.log(`  - MIMEタイプ: ${result.image.mimeType}`);
		console.log(`  - サイズ: ${result.image.imageData.length} bytes`);
	}
}

async function testRouteMapImage(client: RealEstateImagenClient) {
	console.log("\n=== 路線図生成テスト（手動データ） ===");

	const result = await client.generateRouteMapImage({
		nearestStation: "中目黒",
		lineName: "東急東横線・東京メトロ日比谷線",
		propertyLocation: "東京都目黒区中目黒",
		routes: [
			{
				destination: "渋谷",
				durationMinutes: 4,
				transfers: 0,
				viaLines: ["東急東横線"],
			},
			{
				destination: "横浜",
				durationMinutes: 25,
				transfers: 0,
				viaLines: ["東急東横線"],
			},
			{
				destination: "六本木",
				durationMinutes: 10,
				transfers: 0,
				viaLines: ["東京メトロ日比谷線"],
			},
			{
				destination: "銀座",
				durationMinutes: 15,
				transfers: 0,
				viaLines: ["東京メトロ日比谷線"],
			},
			{
				destination: "新宿",
				durationMinutes: 15,
				transfers: 1,
				viaLines: ["東急東横線", "JR山手線"],
			},
		],
	});

	if (result.error) {
		console.error(`エラー: ${result.error}`);
		return;
	}

	if (result.image) {
		const filename = `test-routemap-image-${Date.now()}.png`;
		writeFileSync(filename, result.image.imageData);
		console.log(`成功! 画像を保存しました: ${filename}`);
		console.log(`  - アスペクト比: ${result.image.aspectRatio}`);
		console.log(`  - MIMEタイプ: ${result.image.mimeType}`);
		console.log(`  - サイズ: ${result.image.imageData.length} bytes`);
	}
}

async function testRouteMapFromAddress(client: RealEstateImagenClient) {
	console.log("\n=== 路線図生成テスト（住所から自動取得） ===");

	const address = process.env.TEST_ADDRESS || "東京都渋谷区恵比寿1-1-1";
	console.log(`住所: ${address}`);

	// まず路線情報を取得して表示
	console.log("\n路線情報を取得中...");
	const routeData = await client.getRouteDataFromAddress({ address });

	if (routeData.error) {
		console.error(`エラー: ${routeData.error}`);
		return;
	}

	if (routeData.nearestStation) {
		console.log("\n最寄り駅情報:");
		console.log(`  - 駅名: ${routeData.nearestStation.name}`);
		console.log(`  - 路線: ${routeData.nearestStation.lines.join("・")}`);
		console.log(`  - 距離: ${routeData.nearestStation.distanceMeters}m`);
		console.log(`  - 徒歩: ${routeData.nearestStation.walkMinutes}分`);
	}

	console.log("\n主要駅への所要時間:");
	for (const route of routeData.routes) {
		console.log(`  - ${route.destination}: ${route.durationMinutes}分`);
	}

	// 画像を生成
	console.log("\n路線図画像を生成中...");
	const result = await client.generateRouteMapFromAddress({ address });

	if (result.error) {
		console.error(`エラー: ${result.error}`);
		return;
	}

	if (result.image) {
		const filename = `test-routemap-from-address-${Date.now()}.png`;
		writeFileSync(filename, result.image.imageData);
		console.log(`成功! 画像を保存しました: ${filename}`);
		console.log(`  - アスペクト比: ${result.image.aspectRatio}`);
		console.log(`  - MIMEタイプ: ${result.image.mimeType}`);
		console.log(`  - サイズ: ${result.image.imageData.length} bytes`);
	}
}

async function main() {
	const testType = process.argv[2] || "all";

	console.log("=== Imagen Client テスト ===");
	console.log(`テストタイプ: ${testType}`);

	const client = new RealEstateImagenClient();

	switch (testType) {
		case "property":
			await testPropertyImage(client);
			break;
		case "floorplan":
			await testFloorPlanImage(client);
			break;
		case "routemap":
			await testRouteMapImage(client);
			break;
		case "routemap-address":
			await testRouteMapFromAddress(client);
			break;
		case "all":
			await testPropertyImage(client);
			await testFloorPlanImage(client);
			await testRouteMapImage(client);
			await testRouteMapFromAddress(client);
			break;
		default:
			console.error(`不明なテストタイプ: ${testType}`);
			console.log(
				"使用可能: property, floorplan, routemap, routemap-address, all",
			);
			process.exit(1);
	}

	console.log("\n=== テスト完了 ===");
}

main().catch(console.error);
