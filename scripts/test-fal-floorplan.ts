/**
 * 間取り図マスク合成テスト
 * SAM-3のマスク画像を縦に並べて1枚に合成
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

import { fal } from "@fal-ai/client";
import ky from "ky";
import mime from "mime-types";
import sharp from "sharp";

const SAMPLE_MAISOKU_PATH = process.argv[2] || "";
const PROMPT = process.argv[3] || "floor plan";

function fileToDataUrl(filePath: string): string {
	const buffer = readFileSync(filePath);
	const mimeType = mime.lookup(filePath) || "image/jpeg";
	const base64 = buffer.toString("base64");
	return `data:${mimeType};base64,${base64}`;
}

async function main() {
	console.log("=== 間取り図マスク合成テスト ===\n");

	if (!SAMPLE_MAISOKU_PATH) {
		console.error("使用方法: bun scripts/test-fal-floorplan-merge.ts <path>");
		process.exit(1);
	}

	console.log(`ファイル: ${SAMPLE_MAISOKU_PATH}`);
	console.log(`プロンプト: "${PROMPT}"`);
	const imageUrl = fileToDataUrl(SAMPLE_MAISOKU_PATH);

	console.log("\n🔍 SAM-3 で間取り図を検出中...");

	const result = await fal.subscribe("fal-ai/sam-3/image", {
		input: {
			image_url: imageUrl,
			prompt: PROMPT,
			return_multiple_masks: true,
			include_scores: true,
			include_boxes: true,
		},
	});

	const data = result.data as {
		masks?: Array<{ url: string }>;
		metadata?: Array<{ index: number; score: number; box: number[] }>;
	};

	if (!data.masks || data.masks.length === 0) {
		console.error("❌ 間取り図を検出できませんでした");
		process.exit(1);
	}

	console.log(`✅ ${data.masks.length} 個のマスクを検出`);

	// スコア情報を表示
	if (data.metadata) {
		for (let i = 0; i < data.metadata.length; i++) {
			const m = data.metadata[i];
			console.log(`  [${i}] score=${m.score.toFixed(3)}`);
		}
	}

	// スコアが0.7以上のマスクだけを使用
	const MIN_SCORE = 0.7;
	const filteredIndices = data.metadata
		? data.metadata
				.map((m, i) => ({ index: i, score: m.score }))
				.filter((m) => m.score >= MIN_SCORE)
				.map((m) => m.index)
		: data.masks.map((_, i) => i);

	console.log(
		`  フィルタ後: ${filteredIndices.length} 個 (score >= ${MIN_SCORE})`,
	);

	if (filteredIndices.length === 0) {
		console.error("❌ 有効なマスクがありません");
		process.exit(1);
	}

	// 各マスクをダウンロードしてトリミング
	console.log("\n📥 マスク画像をダウンロード＆トリミング...");

	const allImages: {
		buffer: Buffer;
		metadata: sharp.Metadata;
		yPosition: number;
		index: number;
	}[] = [];

	for (const i of filteredIndices) {
		const mask = data.masks[i];
		const blob = await ky.get(mask.url).blob();
		const buffer = Buffer.from(await blob.arrayBuffer());

		// トリミング（余白除去）
		const trimmed = await sharp(buffer).trim().png().toBuffer();
		const metadata = await sharp(trimmed).metadata();

		// Y位置（上から何番目か）を取得
		const yPosition = data.metadata?.[i]?.box?.[1] ?? i;

		allImages.push({
			buffer: trimmed,
			metadata,
			yPosition,
			index: i,
		});

		console.log(
			`  mask[${i}]: ${metadata.width} x ${metadata.height} (y=${(yPosition * 100).toFixed(1)}%)`,
		);
	}

	// 間取り図は横長（アスペクト比 > 2）のものだけを選択
	const trimmedImages = allImages.filter((img) => {
		const aspectRatio = img.metadata.width / img.metadata.height;
		const isFloorPlan = aspectRatio > 2;
		if (!isFloorPlan) {
			console.log(
				`  → mask[${img.index}] を除外 (アスペクト比=${aspectRatio.toFixed(2)})`,
			);
		}
		return isFloorPlan;
	});

	console.log(`  間取り図: ${trimmedImages.length} 個`);

	if (trimmedImages.length === 0) {
		console.error("❌ 間取り図が見つかりません");
		process.exit(1);
	}

	// Y位置でソート（上から下の順）
	trimmedImages.sort((a, b) => a.yPosition - b.yPosition);

	// 合成画像のサイズを計算
	const padding = 20; // 画像間の余白
	const maxWidth = Math.max(...trimmedImages.map((img) => img.metadata.width));
	const totalHeight =
		trimmedImages.reduce((sum, img) => sum + img.metadata.height, 0) +
		padding * (trimmedImages.length - 1);

	console.log(`\n🎨 合成中... (${maxWidth} x ${totalHeight})`);

	// 白背景に各画像を配置
	const composites: sharp.OverlayOptions[] = [];
	let currentY = 0;

	for (const img of trimmedImages) {
		composites.push({
			input: img.buffer,
			left: Math.floor((maxWidth - img.metadata.width) / 2), // 中央揃え
			top: currentY,
		});
		currentY += img.metadata.height + padding;
	}

	const mergedBuffer = await sharp({
		create: {
			width: maxWidth,
			height: totalHeight,
			channels: 4,
			background: { r: 255, g: 255, b: 255, alpha: 1 },
		},
	})
		.composite(composites)
		.png()
		.toBuffer();

	const filename = `test-floorplan-merged-${Date.now()}.png`;
	writeFileSync(filename, mergedBuffer);

	console.log("\n========================================");
	console.log("✅ 完了!");
	console.log("========================================");
	console.log(`ファイル: ${filename}`);
	console.log(`サイズ: ${maxWidth} x ${totalHeight}`);
	console.log(`容量: ${mergedBuffer.length} bytes`);
	console.log("========================================");
}

main().catch(console.error);
