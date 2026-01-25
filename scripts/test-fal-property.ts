/**
 * 現状 geminiでクロップして再生成する方がいいのでそのまま
 * 物件画像抽出テストスクリプト
 * SAM-3 (Fal AI) を使用してマイソク画像から物件外観写真を検出
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
const PROMPT = process.argv[3] || "building exterior photo";

function fileToDataUrl(filePath: string): string {
	const buffer = readFileSync(filePath);
	const mimeType = mime.lookup(filePath) || "image/jpeg";
	const base64 = buffer.toString("base64");
	return `data:${mimeType};base64,${base64}`;
}

async function main() {
	console.log("=== 物件画像抽出テスト ===\n");

	if (!SAMPLE_MAISOKU_PATH) {
		console.error("使用方法: bun scripts/test-fal-property.ts <path> [prompt]");
		console.error("");
		console.error("プロンプト例:");
		console.error('  "building exterior photo" (デフォルト)');
		console.error('  "apartment building"');
		console.error('  "house exterior"');
		process.exit(1);
	}

	console.log(`ファイル: ${SAMPLE_MAISOKU_PATH}`);
	console.log(`プロンプト: "${PROMPT}"`);
	const imageUrl = fileToDataUrl(SAMPLE_MAISOKU_PATH);

	console.log("\n🔍 SAM-3 で物件画像を検出中...");

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
		console.error("❌ 物件画像を検出できませんでした");
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

	// 各マスクをダウンロードして保存
	console.log("\n📥 マスク画像をダウンロード...");

	for (let i = 0; i < data.masks.length; i++) {
		const mask = data.masks[i];
		const blob = await ky.get(mask.url).blob();
		const buffer = Buffer.from(await blob.arrayBuffer());

		// トリミング（余白除去）
		const trimmed = await sharp(buffer).trim().png().toBuffer();
		const metadata = await sharp(trimmed).metadata();

		const filename = `test-property-${i + 1}-${Date.now()}.png`;
		writeFileSync(filename, trimmed);

		const score = data.metadata?.[i]?.score?.toFixed(3) ?? "?";
		console.log(
			`  保存: ${filename} (${metadata.width} x ${metadata.height}, score=${score})`,
		);
	}

	console.log("\n=== 完了 ===");
}

main().catch(console.error);
