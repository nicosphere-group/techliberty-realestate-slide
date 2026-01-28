/**
 * postinstall スクリプト
 * @sparticuz/chromium から Chromium バイナリを抽出し、
 * public/chromium-pack.tar にパッケージングする
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const OUTPUT_FILE = path.join(PUBLIC_DIR, "chromium-pack.tar");
const NODE_MODULES_DIR = path.join(__dirname, "..", "node_modules");

async function main() {
	console.log("📦 Packaging Chromium for Vercel deployment...");

	try {
		// @sparticuz/chromium のbinディレクトリを直接参照
		const binDir = path.join(NODE_MODULES_DIR, "@sparticuz", "chromium", "bin");

		console.log(`📁 Looking for Chromium at: ${binDir}`);

		if (!fs.existsSync(binDir)) {
			console.log("⚠️  Chromium bin directory not found, skipping packaging");
			console.log("   This is expected if @sparticuz/chromium is not installed");
			return;
		}

		// binディレクトリの内容を確認
		const binContents = fs.readdirSync(binDir);
		console.log(`📁 Bin directory contents: ${binContents.join(", ")}`);

		// public ディレクトリが存在することを確認
		if (!fs.existsSync(PUBLIC_DIR)) {
			fs.mkdirSync(PUBLIC_DIR, { recursive: true });
		}

		// tar ファイルを作成
		console.log(`📁 Output: ${OUTPUT_FILE}`);

		execSync(`tar -cf "${OUTPUT_FILE}" -C "${binDir}" .`, {
			stdio: "inherit",
		});

		const stats = fs.statSync(OUTPUT_FILE);
		const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
		console.log(`✅ Chromium packaged successfully (${sizeMB} MB)`);
	} catch (error) {
		console.error("❌ Failed to package Chromium:", error.message);
		// エラーでもビルドを続行（ローカル開発時など）
	}
}

main();
