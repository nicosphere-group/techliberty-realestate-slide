/**
 * S3アップロード テストスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/test-s3-upload.ts [filePath]
 *
 * filePath:
 *   アップロードするローカルファイルのパス（省略時はテキストをアップロード）
 *
 * 環境変数:
 *   AWS_REGION
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import mime from "mime-types";

import { uploadToS3 } from "../lib/slide-generator/utils/upload";

async function main() {
	const filePath = process.argv[2];
	let blob: Blob;
	let filename = "sample.txt";

	if (filePath) {
		const absolutePath = resolve(process.cwd(), filePath);
		const buffer = readFileSync(absolutePath);
		const mimeType = mime.lookup(absolutePath) || "application/octet-stream";
		blob = new Blob([buffer], { type: String(mimeType) });
		filename = absolutePath;
		console.log(`ファイルを読み込みました: ${absolutePath}`);
		console.log(`  - MIMEタイプ: ${blob.type}`);
		console.log(`  - サイズ: ${buffer.byteLength} bytes`);
	} else {
		const content = `S3 upload test - ${new Date().toISOString()}`;
		blob = new Blob([content], { type: "text/plain" });
		console.log("テキストデータをアップロードします。");
		console.log(`  - 内容: ${content}`);
		console.log(`  - サイズ: ${content.length} bytes`);
	}

	console.log("\nアップロード中...");
	const url = await uploadToS3(blob, "test-uploads");

	console.log("\n成功:");
	console.log(`  - ファイル: ${filename}`);
	console.log(`  - URL: ${url}`);
}

main().catch((error) => {
	console.error("S3アップロード中にエラーが発生しました:", error);
	process.exit(1);
});
