/**
 * 画像生成・抽出関連のツール定義
 * スライド1（表紙）、スライド3（間取り）で使用
 */
import { tool } from "ai";
import { z } from "zod";
import { RealEstateImagenClient } from "@/lib/imagen/client";
import { uploadToS3 } from "./upload";

// シングルトンインスタンス
let imagenClient: RealEstateImagenClient | null = null;

function getImagenClient(): RealEstateImagenClient {
	if (!imagenClient) {
		imagenClient = new RealEstateImagenClient();
	}
	return imagenClient;
}

/**
 * 物件画像抽出スキーマ
 */
const extractPropertyImageSchema = z.object({
	maisokuImageUrl: z.string().describe("マイソク画像のURL（data:URL形式も可）"),
});

type ExtractPropertyImageParams = z.infer<typeof extractPropertyImageSchema>;

/**
 * マイソク画像から物件外観写真を抽出するツール
 * 2段階処理: 領域検出 → クロップ → 再生成
 */
export const extractPropertyImageTool = tool({
	description:
		"マイソク画像から物件の外観写真を抽出し、高品質な画像を生成します。表紙スライドで使用するメインビジュアルとして最適化されます。",
	inputSchema: extractPropertyImageSchema,
	execute: async (params: ExtractPropertyImageParams) => {
		const client = getImagenClient();
		const result = await client.extractPropertyImage({
			maisokuImageUrl: params.maisokuImageUrl,
		});

		if (result.error || !result.image) {
			throw new Error(result.error || "物件外観写真の抽出に失敗しました。");
		}

		// S3にアップロード
		const url = await uploadToS3(
			result.image.imageData,
			"property-images",
			result.image.mimeType,
		);

		return {
			imageUrl: url,
			mimeType: result.image.mimeType,
		};
	},
});

/**
 * 間取り図抽出スキーマ
 */
const extractFloorplanImageSchema = z.object({
	maisokuImageUrl: z.string().describe("マイソク画像のURL（data:URL形式も可）"),
});

type ExtractFloorplanImageParams = z.infer<typeof extractFloorplanImageSchema>;

/**
 * マイソク画像から間取り図を抽出するツール
 * 2段階処理: 領域検出 → クロップ → 再生成
 */
export const extractFloorplanImageTool = tool({
	description:
		"マイソク画像から間取り図を抽出し、高品質な画像を生成します。間取り詳細スライドで使用する見やすい間取り図として最適化されます。",
	inputSchema: extractFloorplanImageSchema,
	execute: async (params: ExtractFloorplanImageParams) => {
		const client = getImagenClient();
		const result = await client.extractFloorPlanImage({
			maisokuImageUrl: params.maisokuImageUrl,
		});

		if (result.error || !result.image) {
			throw new Error(result.error || "間取り図の抽出に失敗しました。");
		}

		// S3にアップロード
		const url = await uploadToS3(
			result.image.imageData,
			"floorplan-images",
			result.image.mimeType,
		);

		return {
			imageUrl: url,
			mimeType: result.image.mimeType,
		};
	},
});

/**
 * スライド1で使用するツール一覧
 */
export const coverTools = {
	extract_property_image: extractPropertyImageTool,
};

/**
 * スライド3で使用するツール一覧
 */
export const floorplanTools = {
	extract_floorplan_image: extractFloorplanImageTool,
};
