/**
 * ハザードマップ・避難所関連のツール定義
 * スライド7（災害リスク）で使用
 */
import { tool } from "ai";
import {
	HazardMapGenerator,
	type HazardMapOptions,
	hazardMapOptionsSchema,
} from "@/lib/hazard-map";
import {
	ShelterMapGenerator,
	type ShelterMapOptions,
	shelterMapOptionsSchema,
} from "@/lib/shelter-map";
import { uploadToS3 } from "./upload";

// シングルトンインスタンス
const hazardMapGenerator = new HazardMapGenerator();
const shelterMapGenerator = new ShelterMapGenerator();

/**
 * ハザードマップ画像URL生成ツール
 * 国土交通省ハザードマップポータルのデータを使用
 */
export const getHazardMapUrlTool = tool({
	description:
		"指定された住所に基づいて、国土交通省ハザードマップポータルのハザードマップ画像URLを取得します。洪水、高潮、津波、土砂災害などのリスク情報を可視化した地図画像を生成します。",
	inputSchema: hazardMapOptionsSchema,
	execute: async (params: HazardMapOptions) => {
		const buffer = await hazardMapGenerator.generate(params);
		const format = params.format || "png";
		const url = await uploadToS3(buffer, "hazard-maps", `image/${format}`);
		return { url };
	},
});

/**
 * 避難所マップ生成ツール
 * 国土地理院の指定緊急避難場所データを使用
 */
export const generateShelterMapTool = tool({
	description:
		"指定された住所周辺の最寄り避難所（最大3箇所）のマーカー付き地図画像を生成します。各避難所の名前と徒歩時間を含む詳細情報を返します。",
	inputSchema: shelterMapOptionsSchema,
	execute: async (params: ShelterMapOptions) => {
		// 地図画像を生成
		const buffer = await shelterMapGenerator.generate(params);
		const format = params.format || "png";
		const url = await uploadToS3(buffer, "shelter-maps", `image/${format}`);

		// 避難所データも取得（距離順で最寄りN箇所）
		const zoom = params.zoom ?? 14;
		const maxShelters = params.maxShelters ?? 3;
		const nearestShelters = await shelterMapGenerator.getNearestShelters(
			params.center,
			zoom,
			maxShelters,
		);

		return {
			imageUrl: url,
			shelters: nearestShelters.map((s) => ({
				name: (s.properties.facility_name_ja as string) || "避難所",
				type: "指定緊急避難場所",
				distance: `徒歩約${s.walkingMinutes}分`,
				walkingMinutes: s.walkingMinutes,
				lat: s.geometry.coordinates[1],
				lng: s.geometry.coordinates[0],
			})),
		};
	},
});

/**
 * スライド7で使用するツール一覧
 */
export const hazardTools = {
	get_hazard_map_url: getHazardMapUrlTool,
	generate_shelter_map: generateShelterMapTool,
};
