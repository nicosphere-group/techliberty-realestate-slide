import z from "zod";

/**
 * テンプレート用コンテンツスキーマ定義
 *
 * 注意: Google Gemini の構造化出力は文字列の maxLength を強制しない
 * そのため、文字数制限は .describe() でAIに伝え、配列の制限のみ .max() で指定する
 *
 * 共通制約ガイドライン（AIへの指示用）:
 * - タイトル（h1）: 最大30文字
 * - サブタイトル: 最大50文字
 * - 説明文: 最大100文字
 * - リスト項目テキスト: 最大40文字
 * - リスト項目数: 最大4〜5個
 */

// ========================================
// 共通スキーマ
// ========================================

/** ハイライト項目（キーバリュー形式） */
export const highlightItemSchema = z.object({
	label: z.string().describe("ラベル（15文字以内）"),
	value: z.string().describe("値（30文字以内）"),
});

export type HighlightItem = z.infer<typeof highlightItemSchema>;

// ========================================
// 1. タイトルスライド (title)
// ========================================

export const titleContentSchema = z.object({
	/** 物件名 */
	propertyName: z.string().describe("物件名（30文字以内）"),
	/** サブタイトル（例: 物件種別、所在地） */
	subtitle: z.string().describe("サブタイトル（50文字以内）").optional(),
	/** 顧客名 */
	customerName: z.string().describe("顧客名（20文字以内）"),
	/** 作成日 */
	createdDate: z.string().describe("作成日（20文字以内）"),
	/** 担当者名 */
	agentName: z.string().describe("担当者名（20文字以内）"),
	/** 担当者連絡先（電話） */
	agentPhone: z.string().describe("電話番号（20文字以内）").optional(),
	/** 担当者連絡先（メール） */
	agentEmail: z.string().describe("メールアドレス（40文字以内）").optional(),
	/** ハイライト情報（最大3項目） */
	highlights: z
		.array(highlightItemSchema)
		.max(3)
		.describe("ハイライト情報（最大3項目）")
		.optional(),
	/** 背景画像URL */
	backgroundImageUrl: z.url().optional(),
});

export type TitleContent = z.infer<typeof titleContentSchema>;

// ========================================
// 2. 3カラムスライド (three-column)
// ========================================

export const threeColumnItemSchema = z.object({
	/** カラムタイトル */
	title: z.string().describe("カラムタイトル（20文字以内）"),
	/** カラム説明文 */
	description: z.string().describe("カラム説明文（60文字以内）"),
	/** リスト項目（最大3つ） */
	items: z
		.array(z.string().describe("項目（40文字以内）"))
		.max(3)
		.describe("リスト項目（最大3つ）")
		.optional(),
	/** アイコン（絵文字1文字を推奨） */
	icon: z.string().describe("アイコン（絵文字1文字を推奨、例: 🏠）").optional(),
});

export type ThreeColumnItem = z.infer<typeof threeColumnItemSchema>;

export const threeColumnContentSchema = z.object({
	/** スライドタイトル */
	title: z.string().describe("スライドタイトル（30文字以内）"),
	/** サブタイトル */
	subtitle: z.string().describe("サブタイトル（50文字以内）").optional(),
	/** 3カラムのコンテンツ（必ず3つ） */
	columns: z
		.array(threeColumnItemSchema)
		.min(3)
		.max(3)
		.describe("3カラムのコンテンツ（必ず3つ）"),
});

export type ThreeColumnContent = z.infer<typeof threeColumnContentSchema>;

// ========================================
// 3, 10. コンテンツ左スライド (content-left)
// ========================================

export const contentLeftContentSchema = z.object({
	/** スライドタイトル */
	title: z.string().describe("スライドタイトル（30文字以内）"),
	/** 左側の画像URL */
	imageUrl: z.url().optional(),
	/** 左側の画像キャプション */
	imageCaption: z.string().describe("画像キャプション（30文字以内）").optional(),
	/** 右側のコンテンツ */
	content: z.object({
		/** 見出し */
		heading: z.string().describe("見出し（25文字以内）"),
		/** 説明文 */
		description: z.string().describe("説明文（100文字以内）").optional(),
		/** リスト項目（最大4つ） */
		items: z
			.array(
				z.object({
					label: z.string().describe("ラベル（15文字以内）").optional(),
					text: z.string().describe("テキスト（40文字以内）"),
				}),
			)
			.max(4)
			.describe("リスト項目（最大4つ）")
			.optional(),
	}),
});

export type ContentLeftContent = z.infer<typeof contentLeftContentSchema>;

// ========================================
// 4, 7. コンテンツ右スライド (content-right)
// ========================================

export const contentRightContentSchema = z.object({
	/** スライドタイトル */
	title: z.string().describe("スライドタイトル（30文字以内）"),
	/** 右側の画像URL */
	imageUrl: z.url().optional(),
	/** 右側の画像キャプション */
	imageCaption: z.string().describe("画像キャプション（30文字以内）").optional(),
	/** 左側のコンテンツ */
	content: z.object({
		/** 見出し */
		heading: z.string().describe("見出し（25文字以内）"),
		/** 説明文 */
		description: z.string().describe("説明文（100文字以内）").optional(),
		/** リスト項目（最大4つ） */
		items: z
			.array(
				z.object({
					label: z.string().describe("ラベル（15文字以内）").optional(),
					text: z.string().describe("テキスト（40文字以内）"),
				}),
			)
			.max(4)
			.describe("リスト項目（最大4つ）")
			.optional(),
	}),
});

export type ContentRightContent = z.infer<typeof contentRightContentSchema>;

// ========================================
// 5. グリッドスライド (grid)
// ========================================

export const gridItemSchema = z.object({
	/** 項目タイトル */
	title: z.string().describe("項目タイトル（施設名など、20文字以内）"),
	/** 項目説明 */
	description: z.string().describe("項目説明（40文字以内）").optional(),
	/** 項目画像URL */
	imageUrl: z.url().optional(),
	/** アイコン（絵文字1文字を推奨） */
	icon: z.string().describe("アイコン（絵文字1文字を推奨、例: 🏪）").optional(),
	/** 距離・時間などの補足情報 */
	meta: z.string().describe("距離・時間などの補足情報（20文字以内）").optional(),
});

export type GridItem = z.infer<typeof gridItemSchema>;

export const gridContentSchema = z.object({
	/** スライドタイトル */
	title: z.string().describe("スライドタイトル（30文字以内）"),
	/** サブタイトル */
	subtitle: z.string().describe("サブタイトル（50文字以内）").optional(),
	/** グリッド項目（最大6つ） */
	items: z.array(gridItemSchema).max(6).describe("グリッド項目（最大6つ）"),
	/** 地図画像URL */
	mapImageUrl: z.url().optional(),
});

export type GridContent = z.infer<typeof gridContentSchema>;

// ========================================
// 6, 8, 9. データフォーカススライド (data-focus)
// ========================================

export const metricItemSchema = z.object({
	/** メトリクスラベル */
	label: z.string().describe("メトリクスラベル（15文字以内）"),
	/** メトリクス値 */
	value: z.string().describe("メトリクス値（15文字以内）"),
	/** 単位 */
	unit: z.string().describe("単位（10文字以内）").optional(),
	/** 変化率などの補足 */
	change: z.string().describe("変化率などの補足（15文字以内）").optional(),
});

export type MetricItem = z.infer<typeof metricItemSchema>;

export const tableRowSchema = z.object({
	/** 行ラベル */
	label: z.string().describe("行ラベル（20文字以内）"),
	/** 値 */
	value: z.string().describe("値（20文字以内）"),
	/** 備考 */
	note: z.string().describe("備考（30文字以内）").optional(),
});

export type TableRow = z.infer<typeof tableRowSchema>;

export const dataFocusContentSchema = z.object({
	/** スライドタイトル */
	title: z.string().describe("スライドタイトル（30文字以内）"),
	/** サブタイトル */
	subtitle: z.string().describe("サブタイトル（50文字以内）").optional(),
	/** メインメトリクス（最大4つ） */
	metrics: z
		.array(metricItemSchema)
		.max(4)
		.describe("メインメトリクス（最大4つ）")
		.optional(),
	/** テーブルデータ（最大5行） */
	table: z
		.object({
			headers: z
				.array(z.string().describe("ヘッダー（15文字以内）"))
				.max(4)
				.describe("ヘッダー（最大4列）"),
			rows: z
				.array(
					z
						.array(z.string().describe("セル（20文字以内）"))
						.max(4)
						.describe("行データ（最大4列）"),
				)
				.max(5)
				.describe("行データ（最大5行）"),
		})
		.optional(),
	/** 補足テキスト */
	footnote: z.string().describe("補足テキスト（100文字以内）").optional(),
	/** チャート/グラフ画像URL */
	chartImageUrl: z.url().optional(),
});

export type DataFocusContent = z.infer<typeof dataFocusContentSchema>;

// ========================================
// 11. セクションスライド (section)
// ========================================

export const sectionStepSchema = z.object({
	/** ステップ番号 */
	number: z.number().min(1).max(10).describe("ステップ番号（1〜10）"),
	/** ステップタイトル */
	title: z.string().describe("ステップタイトル（15文字以内）"),
	/** ステップ説明 */
	description: z.string().describe("ステップ説明（40文字以内）").optional(),
});

export type SectionStep = z.infer<typeof sectionStepSchema>;

export const sectionContentSchema = z.object({
	/** スライドタイトル */
	title: z.string().describe("スライドタイトル（30文字以内）"),
	/** サブタイトル */
	subtitle: z.string().describe("サブタイトル（50文字以内）").optional(),
	/** ステップ（最大5つ） */
	steps: z.array(sectionStepSchema).max(5).describe("ステップ（最大5つ）"),
	/** 補足テキスト */
	footnote: z.string().describe("補足テキスト（100文字以内）").optional(),
});

export type SectionContent = z.infer<typeof sectionContentSchema>;

// ========================================
// 12. フルイメージスライド (full-image)
// ========================================

export const fullImageContentSchema = z.object({
	/** スライドタイトル */
	title: z.string().describe("スライドタイトル（30文字以内）").optional(),
	/** 画像URL配列 */
	imageUrls: z.array(z.string()).min(1).describe("画像URL配列（最低1枚）"),
	/** キャプション */
	caption: z.string().describe("キャプション（50文字以内）").optional(),
});

export type FullImageContent = z.infer<typeof fullImageContentSchema>;

// ========================================
// ユニオン型
// ========================================

export type TemplateContent =
	| { type: "title"; data: TitleContent }
	| { type: "three-column"; data: ThreeColumnContent }
	| { type: "content-left"; data: ContentLeftContent }
	| { type: "content-right"; data: ContentRightContent }
	| { type: "grid"; data: GridContent }
	| { type: "data-focus"; data: DataFocusContent }
	| { type: "section"; data: SectionContent }
	| { type: "full-image"; data: FullImageContent };

// ========================================
// スキーママップ（レイアウト名→スキーマ）
// ========================================

export const contentSchemas = {
	title: titleContentSchema,
	"three-column": threeColumnContentSchema,
	"content-left": contentLeftContentSchema,
	"content-right": contentRightContentSchema,
	grid: gridContentSchema,
	"data-focus": dataFocusContentSchema,
	section: sectionContentSchema,
	"full-image": fullImageContentSchema,
} as const;

export type ContentSchemaMap = typeof contentSchemas;
