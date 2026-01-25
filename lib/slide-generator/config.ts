import type { DataSource } from "./schemas";
import {
	type SlideType,
	SLIDE_TYPES,
	SLIDE_TYPE_TITLES,
	SLIDE_TYPE_DESCRIPTIONS,
} from "./types/slide-types";

/**
 * 固定スライド定義（12枚構成）
 *
 * 参照: docs/スライド構成.md
 *
 * レイアウトベースからスライドタイプベースに移行
 * 各スライドタイプは固定のデザインテンプレートを持つ
 */

export interface FixedSlideDefinition {
	/** スライド番号（1-12） */
	index: number;
	/** スライドタイプ（固定デザインテンプレート） */
	slideType: SlideType;
	/** スライドタイトル */
	title: string;
	/** 概要説明 */
	description: string;
	/** データソースタイプ */
	dataSource: DataSource;
	/** リサーチが必要な場合のトピック */
	researchTopics?: string[];
	/** コンテンツヒント */
	contentHints: string[];
}

/**
 * 固定の12枚スライド構成
 */
export const SLIDE_DEFINITIONS: FixedSlideDefinition[] = [
	{
		index: 0,
		slideType: "flyer",
		title: SLIDE_TYPE_TITLES.flyer,
		description: SLIDE_TYPE_DESCRIPTIONS.flyer,
		dataSource: "primary",
		contentHints: ["マイソク画像"],
	},
	{
		index: 1,
		slideType: "cover",
		title: SLIDE_TYPE_TITLES.cover,
		description: SLIDE_TYPE_DESCRIPTIONS.cover,
		dataSource: "primary",
		contentHints: ["物件名", "顧客名", "作成日", "担当者情報"],
	},
	{
		index: 2,
		slideType: "property-highlight",
		title: SLIDE_TYPE_TITLES["property-highlight"],
		description: SLIDE_TYPE_DESCRIPTIONS["property-highlight"],
		dataSource: "ai-generated",
		contentHints: ["価格の魅力", "立地・アクセス", "間取り・設備"],
	},
	{
		index: 3,
		slideType: "floor-plan",
		title: SLIDE_TYPE_TITLES["floor-plan"],
		description: SLIDE_TYPE_DESCRIPTIONS["floor-plan"],
		dataSource: "ai-generated",
		contentHints: ["間取り図", "部屋の使い方", "動線コメント", "採光・眺望"],
	},
	{
		index: 4,
		slideType: "access",
		title: SLIDE_TYPE_TITLES.access,
		description: SLIDE_TYPE_DESCRIPTIONS.access,
		dataSource: "research",
		researchTopics: ["最寄り駅情報", "主要駅への所要時間"],
		contentHints: ["最寄り駅", "路線情報", "主要駅への所要時間"],
	},
	{
		index: 5,
		slideType: "nearby",
		title: SLIDE_TYPE_TITLES.nearby,
		description: SLIDE_TYPE_DESCRIPTIONS.nearby,
		dataSource: "research",
		researchTopics: [
			"周辺スーパー",
			"コンビニ",
			"公園",
			"病院・クリニック",
		],
		contentHints: ["スーパー", "コンビニ", "公園", "病院", "周辺地図"],
	},
	{
		index: 6,
		slideType: "price-analysis",
		title: SLIDE_TYPE_TITLES["price-analysis"],
		description: SLIDE_TYPE_DESCRIPTIONS["price-analysis"],
		dataSource: "research",
		researchTopics: ["周辺相場", "成約事例", "価格動向"],
		contentHints: ["周辺相場比較", "価格分析コメント"],
	},
	{
		index: 7,
		slideType: "hazard",
		title: SLIDE_TYPE_TITLES.hazard,
		description: SLIDE_TYPE_DESCRIPTIONS.hazard,
		dataSource: "research",
		researchTopics: ["洪水リスク", "土砂災害リスク", "避難所"],
		contentHints: ["ハザードマップ", "災害リスク評価", "最寄り避難所"],
	},
	{
		index: 8,
		slideType: "funding",
		title: SLIDE_TYPE_TITLES.funding,
		description: SLIDE_TYPE_DESCRIPTIONS.funding,
		dataSource: "calculated",
		contentHints: ["月々返済額", "総返済額", "借入可能額"],
	},
	{
		index: 9,
		slideType: "expenses",
		title: SLIDE_TYPE_TITLES.expenses,
		description: SLIDE_TYPE_DESCRIPTIONS.expenses,
		dataSource: "static-template",
		contentHints: ["仲介手数料", "登記費用", "火災保険", "その他諸費用"],
	},
	{
		index: 10,
		slideType: "tax",
		title: SLIDE_TYPE_TITLES.tax,
		description: SLIDE_TYPE_DESCRIPTIONS.tax,
		dataSource: "static-template",
		contentHints: ["住宅ローン控除", "適用条件", "節税効果"],
	},
	{
		index: 11,
		slideType: "purchase-flow",
		title: SLIDE_TYPE_TITLES["purchase-flow"],
		description: SLIDE_TYPE_DESCRIPTIONS["purchase-flow"],
		dataSource: "static-template",
		contentHints: ["申込", "契約", "決済", "引渡し"],
	},
];

/**
 * スライド番号からスライド定義を取得
 */
export function getSlideDefinition(
	index: number,
): FixedSlideDefinition | undefined {
	return SLIDE_DEFINITIONS.find((s) => s.index === index);
}

/**
 * スライドタイプからスライド定義を取得
 */
export function getSlideDefinitionByType(
	slideType: SlideType,
): FixedSlideDefinition | undefined {
	return SLIDE_DEFINITIONS.find((s) => s.slideType === slideType);
}

/**
 * データソース別にスライドを分類
 */
export function getSlidesByDataSource(
	dataSource: DataSource,
): FixedSlideDefinition[] {
	return SLIDE_DEFINITIONS.filter((s) => s.dataSource === dataSource);
}

/**
 * 全スライドタイプの一覧
 */
export { SLIDE_TYPES, SLIDE_TYPE_TITLES, SLIDE_TYPE_DESCRIPTIONS };
