/**
 * スライドタイプ定義（12種類）
 *
 * レイアウトベースから、スライド目的ベースに移行
 * 各スライドタイプは固定のデザインテンプレートを持つ
 */

export const SLIDE_TYPES = [
	"cover", // 1. 表紙
	"property-highlight", // 2. 物件ハイライト
	"floor-plan", // 3. 間取り詳細
	"access", // 4. 交通アクセス
	"nearby", // 5. 周辺施設
	"price-analysis", // 6. 価格分析
	"hazard", // 7. 災害リスク
	"funding", // 8. 資金計画
	"expenses", // 9. 諸費用
	"tax", // 10. 税制情報
	"purchase-flow", // 11. 購入手続き
	"flyer", // 12. マイソク
] as const;

export type SlideType = (typeof SLIDE_TYPES)[number];

/**
 * スライドタイプごとの日本語タイトル
 */
export const SLIDE_TYPE_TITLES: Record<SlideType, string> = {
	cover: "表紙",
	"property-highlight": "物件ハイライト",
	"floor-plan": "間取り詳細",
	access: "交通アクセス",
	nearby: "周辺施設",
	"price-analysis": "価格分析",
	hazard: "災害リスク",
	funding: "資金計画",
	expenses: "諸費用",
	tax: "税制情報",
	"purchase-flow": "購入手続き",
	flyer: "マイソク",
};

/**
 * スライドタイプごとの説明
 */
export const SLIDE_TYPE_DESCRIPTIONS: Record<SlideType, string> = {
	cover: "顧客名、物件名、作成日、担当者名・連絡先を表示",
	"property-highlight": "物件の推しポイント3点を紹介",
	"floor-plan": "間取り図と部屋の使い方提案",
	access: "最寄り駅と主要駅への所要時間",
	nearby: "周辺の生活利便施設一覧と地図",
	"price-analysis": "周辺相場比較と価格分析",
	hazard: "ハザードマップと避難所情報",
	funding: "資金計画シミュレーション",
	expenses: "諸費用一覧（概算）",
	tax: "住宅ローン控除・税制情報",
	"purchase-flow": "購入手続きフロー",
	flyer: "マイソク画像をそのまま表示",
};

/**
 * スライドタイプごとのインデックス（1始まり）
 */
export const SLIDE_TYPE_INDEX: Record<SlideType, number> = {
	cover: 1,
	"property-highlight": 2,
	"floor-plan": 3,
	access: 4,
	nearby: 5,
	"price-analysis": 6,
	hazard: 7,
	funding: 8,
	expenses: 9,
	tax: 10,
	"purchase-flow": 11,
	flyer: 12,
};

/**
 * インデックスからスライドタイプを取得
 */
export function getSlideTypeByIndex(index: number): SlideType | undefined {
	return SLIDE_TYPES[index - 1];
}

/**
 * スライドタイプが有効かどうかを確認
 */
export function isValidSlideType(type: string): type is SlideType {
	return SLIDE_TYPES.includes(type as SlideType);
}
