/**
 * スライドジェネレーター用ツール定義のインデックス
 *
 * 各スライドで使用するツールをまとめてエクスポートし、
 * スライド番号に応じた適切なツールセットを返す関数を提供します。
 */
import type { Tool } from "ai";
import { generateShelterMapTool, getHazardMapUrlTool } from "./hazard";
// 各モジュールからツールをインポート
import { extractFloorplanImageTool, extractPropertyImageTool } from "./imagen";
import {
	generateNearbyMapTool,
	getStaticMapUrlTool,
	searchNearbyFacilitiesTool,
} from "./nearby";
import {
	fetchNearbyTransactions,
	getMunicipalitiesTool,
	getPriceInfoTool,
	getPricePointsTool,
	type PriceAnalysisResult,
	type SimilarProperty,
} from "./reinfo";
import { generateRouteMapImageTool } from "./route-map-image";

// 個別ツールのエクスポート
export {
	// imagen tools
	extractPropertyImageTool,
	extractFloorplanImageTool,
	// nearby tools
	searchNearbyFacilitiesTool,
	getStaticMapUrlTool,
	generateNearbyMapTool,
	// reinfo tools
	getPriceInfoTool,
	getMunicipalitiesTool,
	getPricePointsTool,
	fetchNearbyTransactions,
	// hazard tools
	getHazardMapUrlTool,
	generateShelterMapTool,
	// route map tools
	generateRouteMapImageTool,
};

// 型のエクスポート
export type { PriceAnalysisResult, SimilarProperty };

/**
 * スライド番号別のツールマッピング
 *
 * | # | スライド名     | 使用するTool                                      |
 * |---|---------------|--------------------------------------------------|
 * | 1 | 表紙          | extract_property_image                            |
 * | 2 | 物件ハイライト | (なし)                                            |
 * | 3 | 間取り        | extract_floorplan_image                           |
 * | 4 | 交通アクセス   | (スキップ)                                        |
 * | 5 | 周辺施設       | generate_nearby_map                               |
 * | 6 | 価格分析       | get_price_info, get_municipalities                |
 * | 7 | 災害リスク     | get_hazard_map_url, generate_shelter_map          |
 * | 8-11 | 資金計画等  | (なし)                                            |
 * | 0 | マイソク       | (なし - 入力画像をそのまま使用)                    |
 */
const SLIDE_TOOLS: Record<number, Record<string, Tool>> = {
	1: {
		extract_property_image: extractPropertyImageTool,
	},
	3: {
		extract_floorplan_image: extractFloorplanImageTool,
	},
	4: {
		generate_route_map_image: generateRouteMapImageTool,
	},
	5: {
		generate_nearby_map: generateNearbyMapTool,
	},
	6: {
		get_price_info: getPriceInfoTool,
		get_municipalities: getMunicipalitiesTool,
		get_price_points: getPricePointsTool,
	},
	7: {
		get_hazard_map_url: getHazardMapUrlTool,
		generate_shelter_map: generateShelterMapTool,
	},
};

/**
 * 指定されたスライド番号で使用するツールセットを取得
 *
 * @param slideIndex スライド番号（1-12）
 * @returns そのスライドで使用可能なツールのレコード（ツールがない場合は空オブジェクト）
 *
 * @example
 * const tools = getToolsForSlide(7);
 * // { get_hazard_map_url: ..., generate_shelter_map: ... }
 *
 * const tools = getToolsForSlide(2);
 * // {} (物件ハイライトはツールを使用しない)
 */
export function getToolsForSlide(slideIndex: number): Record<string, Tool> {
	return SLIDE_TOOLS[slideIndex] ?? {};
}

/**
 * 全てのツールを取得
 * デバッグや一括テスト用
 */
export function getAllTools(): Record<string, Tool> {
	return {
		extract_property_image: extractPropertyImageTool,
		extract_floorplan_image: extractFloorplanImageTool,
		generate_nearby_map: generateNearbyMapTool,
		get_price_info: getPriceInfoTool,
		get_municipalities: getMunicipalitiesTool,
		get_price_points: getPricePointsTool,
		get_hazard_map_url: getHazardMapUrlTool,
		generate_shelter_map: generateShelterMapTool,
	};
}

/**
 * 特定のスライドがツールを必要とするかどうかを判定
 *
 * @param slideIndex スライド番号（1-12）
 * @returns ツールが必要な場合はtrue
 */
export function slideRequiresTools(slideIndex: number): boolean {
	return slideIndex in SLIDE_TOOLS;
}

/**
 * ツールを持つスライド番号の一覧を取得
 */
export function getSlidesWithTools(): number[] {
	return Object.keys(SLIDE_TOOLS).map(Number);
}
