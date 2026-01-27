/**
 * スライドタイプ別コンテンツスキーマ（12種類）
 *
 * 各スライドタイプに特化したZodスキーマを定義
 * LLMはこのスキーマに従ってテキスト/画像URLのみを出力する
 *
 * 注意: Google Gemini の構造化出力は文字列の maxLength を強制しない
 * そのため、文字数制限は .describe() でAIに伝え、配列の制限のみ .max() で指定する
 */

import z from "zod";
import type { SlideType } from "../types/slide";

// ========================================
// 1. Cover（表紙）
// ========================================

export const coverContentSchema = z.object({
	propertyName: z.string().describe("物件名（30文字以内）"),
	address: z.string().describe("住所（50文字以内）").optional(),
	companyName: z.string().describe("会社名（40文字以内）"),
	storeName: z.string().describe("店舗名（30文字以内）").optional(),
	storeAddress: z.string().describe("店舗住所（60文字以内）").optional(),
	storePhoneNumber: z.string().describe("店舗電話番号").optional(),
	storeEmailAddress: z.string().describe("店舗メールアドレス").optional(),
	imageUrl: z.string().describe("物件外観画像のURL").optional(),
});

export type CoverContent = z.infer<typeof coverContentSchema>;

// ========================================
// 2. Property Highlight（物件ハイライト）
// ========================================

/**
 * ハイライトカラムの共通スキーマ
 */
const highlightSectionSchema = z.object({
	title: z.string().describe("日本語タイトル（20文字以内）"),
	description: z.string().describe("説明文（60文字以内）"),
	items: z
		.array(
			z.object({
				value: z
					.string()
					.describe("数値や強調テキスト（15文字以内）")
					.optional(),
				text: z.string().describe("項目テキスト（40文字以内）"),
			}),
		)
		.max(3)
		.describe("リスト項目（最大3つ）"),
});

/**
 * 物件ハイライトスキーマ（Location/Quality/Price固定）
 */
export const propertyHighlightContentSchema = z.object({
	propertyName: z.string().describe("物件名（30文字以内）").optional(),
	location: highlightSectionSchema.describe("立地・アクセスの魅力"),
	quality: highlightSectionSchema.describe("物件の品質・特徴"),
	price: highlightSectionSchema.describe("価格・コストパフォーマンス"),
});

export type PropertyHighlightContent = z.infer<
	typeof propertyHighlightContentSchema
>;

// ========================================
// 3. Floor Plan（間取り詳細）
// ========================================

export const floorPlanContentSchema = z.object({
	points: z
		.array(
			z.object({
				title: z.string().describe("ポイントタイトル（20文字以内）"),
				description: z.string().describe("説明文（50文字以内）"),
			}),
		)
		.max(3)
		.describe("間取りのポイント（最大3つ）"),
	specs: z.object({
		area: z.string().describe("専有面積（例: 74.32㎡）"),
		layout: z.string().describe("間取り（例: 2LDK）"),
		balcony: z.string().describe("バルコニー面積（例: 28.6㎡）").optional(),
	}),
	imageUrl: z.string().describe("間取り図画像URL").optional(),
});

export type FloorPlanContent = z.infer<typeof floorPlanContentSchema>;

// ========================================
// 4. Access（交通アクセス）- 放射状路線図マップ対応
// ========================================

/**
 * 最寄り駅情報スキーマ
 */
export const nearestStationSchema = z.object({
	name: z.string().describe("駅名（例: 白金台）"),
	lines: z
		.array(z.string())
		.describe("利用可能路線（例: ['東京メトロ南北線', '都営三田線']）"),
	walkMinutes: z.number().describe("徒歩分数"),
});

/**
 * 主要駅への経路情報スキーマ
 */
export const stationRouteSchema = z.object({
	destination: z.string().describe("到着駅名（例: 東京、新宿、渋谷）"),
	totalMinutes: z.number().describe("電車所要時間（分）"),
	transferCount: z.number().describe("乗換回数"),
	routeSummary: z.string().describe("経路概要（例: 南北線→丸ノ内線）"),
});

/**
 * 空港への経路情報スキーマ
 */
export const airportRouteSchema = z.object({
	destination: z.string().describe("空港名（例: 羽田空港、成田空港）"),
	totalMinutes: z.number().describe("所要時間（分）"),
});

/**
 * 交通アクセススライドコンテンツスキーマ
 * 放射状路線図マップ + 所要時間テキスト表示
 */
export const accessContentSchema = z.object({
	propertyName: z.string().describe("物件名（30文字以内）"),
	address: z.string().describe("住所（50文字以内）"),
	nearestStation: nearestStationSchema.describe("最寄り駅情報"),
	stationRoutes: z
		.array(stationRouteSchema)
		.max(4)
		.describe("主要ターミナル駅への経路（最大4つ）"),
	airportRoutes: z
		.array(airportRouteSchema)
		.max(2)
		.describe("空港への経路（最大2つ: 羽田、成田）"),
	mapImageUrl: z
		.string()
		.describe("路線図マップ画像URL（Base64 Data URL）")
		.optional(),
});

export type AccessContent = z.infer<typeof accessContentSchema>;

// ========================================
// 5. Nearby（周辺施設）
// ========================================

export const facilityGroupSchema = z.object({
	category: z
		.string()
		.describe("カテゴリ名（例: スーパー, コンビニ, 公園, 病院）"),
	color: z
		.string()
		.describe(
			"HTMLカラーコード（#7dabfd=スーパー, #8aae02=コンビニ, #dc8501=公園, #926da6=病院）",
		),
	facilities: z
		.array(
			z.object({
				name: z.string().describe("施設名（25文字以内）"),
				distance: z.string().describe("徒歩時間（例: 5）"),
				number: z.number().describe("マップ上の連番（1, 2, 3...）"),
			}),
		)
		.max(3)
		.describe("施設リスト（最大3つ）"),
});

export const nearbyContentSchema = z.object({
	facilityGroups: z
		.array(facilityGroupSchema)
		.max(4)
		.describe(
			"施設グループ（最大4つ: スーパー、コンビニ、公園、病院）。各カテゴリーは1回のみ含めること。重複不可。",
		),
	address: z.string().describe("物件住所"),
	mapImageUrl: z.string().describe("地図画像URL").optional(),
});

export type NearbyContent = z.infer<typeof nearbyContentSchema>;

// ========================================
// 6. Price Analysis（価格分析）
// ========================================

/**
 * 類似物件の取引データ
 * XPT001 APIから取得したデータを整形
 */
export const similarPropertySchema = z.object({
	name: z.string().describe("物件名・地区名（例: '六本木 3LDK'）"),
	age: z.string().describe("築年（例: '2015年'）"),
	area: z.string().describe("面積（例: '72.5㎡'）"),
	price: z.string().describe("取引価格（例: '5,800万円'）"),
	unitPrice: z.string().describe("坪単価（例: '265万円'）"),
});

/**
 * 対象物件のデータ（マイソクから抽出）
 */
export const targetPropertySchema = z.object({
	name: z.string().describe("物件名"),
	age: z.string().describe("築年数（例: '15年'）"),
	area: z.string().describe("面積（例: '72.5㎡'）"),
	price: z.string().describe("販売価格（例: '5,800万円'）"),
	unitPrice: z.string().describe("坪単価（例: '265万円'）"),
});

export const priceAnalysisContentSchema = z.object({
	targetProperty: targetPropertySchema
		.optional()
		.describe("対象物件のデータ（マイソクから抽出）"),
	similarProperties: z
		.array(similarPropertySchema)
		.max(6)
		.describe("類似物件の取引事例（最大6件、新しい順）"),
	estimatedPriceMin: z.string().describe("推定価格範囲の下限（例: '5,200'）"),
	estimatedPriceMax: z.string().describe("推定価格範囲の上限（例: '6,800'）"),
	averageUnitPrice: z.number().optional().describe("平均坪単価（万円）"),
	dataCount: z.number().optional().describe("取得データ件数"),
});

export type PriceAnalysisContent = z.infer<typeof priceAnalysisContentSchema>;

// ========================================
// 7. Hazard（災害リスク）
// ========================================

export const hazardContentSchema = z.object({
	propertyName: z.string().describe("物件名"),
	address: z.string().describe("住所"),
	description: z
		.string()
		.describe("防災情報の説明文（100文字以内）")
		.optional(),
	hazardRisks: z
		.array(
			z.object({
				type: z.string().describe("災害種別（例: 洪水、土砂災害）"),
				level: z.string().describe("リスクレベル（例: 想定浸水深：0.5m未満）"),
			}),
		)
		.max(3)
		.describe("災害リスク（最大3つ）"),
	shelters: z
		.array(
			z.object({
				name: z.string().describe("避難所名"),
				type: z.string().describe("避難所種別（例: 指定緊急避難場所）"),
				distance: z.string().describe("距離（例: 徒歩約5分）"),
			}),
		)
		.max(3)
		.describe("最寄り避難所（最大3つ）"),
	hazardMapUrl: z.string().describe("ハザードマップ画像URL").optional(),
	shelterMapUrl: z.string().describe("避難所マップ画像URL").optional(),
});

export type HazardContent = z.infer<typeof hazardContentSchema>;

// ========================================
// 8. Funding（資金計画）
// ========================================

export const fundingContentSchema = z.object({
	propertyName: z.string().describe("物件名"),
	propertyAddress: z.string().describe("物件住所").optional(),
	loanConditions: z.object({
		propertyPrice: z.string().describe("物件価格（例: 128,000,000円）"),
		downPayment: z.string().describe("自己資金（例: 28,000,000円）"),
		loanAmount: z.string().describe("借入金額（例: 100,000,000円）"),
		loanTermAndRate: z
			.string()
			.describe("返済期間/金利（例: 35年 / 0.5%（変動））"),
	}),
	monthlyPayments: z.object({
		loanRepayment: z.string().describe("ローン返済額（例: 259,500円）"),
		managementFee: z.string().describe("管理費（例: 28,600円）"),
		repairReserve: z.string().describe("修繕積立金（例: 16,400円）"),
		total: z.string().describe("合計（例: 304,500円）"),
	}),
	note: z.string().describe("注釈（50文字以内）").optional(),
});

export type FundingContent = z.infer<typeof fundingContentSchema>;

// ========================================
// 9. Expenses（諸費用）
// ========================================

export const expensesContentSchema = z.object({
	propertyName: z.string().describe("物件名"),
	propertyPrice: z
		.number()
		.optional()
		.describe(
			"物件価格（万円単位、例: 8000）。諸費用計算に使用。未指定の場合は割合表示",
		),
	expenses: z
		.array(
			z.object({
				item: z.string().describe("項目名（例: 仲介手数料（税込））"),
				amount: z.string().describe("金額（例: 概算 物件価格の3%+6万）"),
			}),
		)
		.max(6)
		.describe("諸費用項目（最大6つ）"),
	totalDescription: z
		.string()
		.describe("合計の説明文（80文字以内）")
		.optional(),
	note: z.string().describe("注釈（80文字以内）").optional(),
});

export type ExpensesContent = z.infer<typeof expensesContentSchema>;

// ========================================
// 10. Tax（税制情報）- 静的テンプレート
// ========================================
// このスライドはLLMによるコンテンツ生成不要
// テンプレート内でハードコードされた税制情報を表示

export const taxContentSchema = z.object({});

export type TaxContent = z.infer<typeof taxContentSchema>;

// ========================================
// 11. Purchase Flow（購入手続き）- 静的テンプレート
// ========================================
// このスライドはLLMによるコンテンツ生成不要
// テンプレート内でハードコードされた購入フローを表示

export const purchaseFlowContentSchema = z.object({});

export type PurchaseFlowContent = z.infer<typeof purchaseFlowContentSchema>;

// ========================================
// 0. Flyer（マイソク）- 静的テンプレート
// ========================================
// このスライドはLLMによるコンテンツ生成不要
// 画像URLのみ外部から渡される

export const flyerContentSchema = z.object({
	imageUrls: z
		.array(z.string())
		.min(1)
		.describe("マイソク画像URL配列（最低1枚）"),
});

export type FlyerContent = z.infer<typeof flyerContentSchema>;

// ========================================
// スキーママップ
// ========================================

export const slideContentSchemas = {
	cover: coverContentSchema,
	"property-highlight": propertyHighlightContentSchema,
	"floor-plan": floorPlanContentSchema,
	access: accessContentSchema,
	nearby: nearbyContentSchema,
	"price-analysis": priceAnalysisContentSchema,
	hazard: hazardContentSchema,
	funding: fundingContentSchema,
	expenses: expensesContentSchema,
	tax: taxContentSchema,
	"purchase-flow": purchaseFlowContentSchema,
	flyer: flyerContentSchema,
} as const;

export type SlideContentSchemaMap = typeof slideContentSchemas;

/**
 * スライドタイプからスキーマを取得
 */
export function getSchemaForSlideType(slideType: SlideType) {
	return slideContentSchemas[slideType];
}

// ========================================
// コンテンツ型のユニオン
// ========================================

export type SlideContentMap = {
	cover: CoverContent;
	"property-highlight": PropertyHighlightContent;
	"floor-plan": FloorPlanContent;
	access: AccessContent;
	nearby: NearbyContent;
	"price-analysis": PriceAnalysisContent;
	hazard: HazardContent;
	funding: FundingContent;
	expenses: ExpensesContent;
	tax: TaxContent;
	"purchase-flow": PurchaseFlowContent;
	flyer: FlyerContent;
};

export type SlideContent = SlideContentMap[SlideType];
