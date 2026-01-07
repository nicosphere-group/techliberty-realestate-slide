import z from "zod";

// ========================================
// Schemas
// ========================================

export const slideLayoutSchema = z.enum([
	"title", // タイトルスライド
	"section", // セクション区切り
	"content-left", // 左に画像/右にテキスト
	"content-right", // 右に画像/左にテキスト
	"three-column", // 3列レイアウト（特徴紹介など）
	"grid", // グリッドレイアウト（ギャラリーなど）
	"full-image", // 全画面画像 + テキストオーバーレイ
	"data-focus", // 数字やグラフ中心
	"contact", // お問い合わせ
]);

export type SlideLayout = z.infer<typeof slideLayoutSchema>;

export const slideDefinitionSchema = z.object({
	pageNumber: z.number().describe("スライドのページ番号（1から開始）"),
	layout: slideLayoutSchema.describe("このスライドに最適なレイアウトタイプ"),
	title: z.string().describe("スライドのタイトル"),
	description: z.string().describe("スライドの内容の概要"),
	contentHints: z
		.array(z.string())
		.describe("スライドに含めるべきコンテンツのヒント"),
	researchTopics: z
		.array(z.string())
		.optional()
		.describe(
			"スライド生成前に調査すべきトピック（contentHintsと同義。無い場合はcontentHintsを使用）",
		),
});

export type SlideDefinition = z.infer<typeof slideDefinitionSchema>;

export const slideResearchResultSchema = z.object({
	summary: z.string().describe("スライド作成に使える要約"),
	keyFacts: z
		.array(
			z.object({
				fact: z.string().describe("スライドに載せられる事実/主張"),
				sourceUrls: z
					.array(z.string().url())
					.describe("このfactを裏付けるURL（複数可）"),
			}),
		)
		.default([]),
	sources: z
		.array(
			z.object({
				title: z.string().optional(),
				url: z.string().url(),
				excerpt: z.string().optional(),
			}),
		)
		.default([]),
});

export const designSystemSchema = z.object({
	themeName: z.string().describe("デザインテーマの名前（例: Modern Luxury）"),
	cssVariables: z
		.array(
			z.object({
				key: z.string().describe("CSS変数名（例: --bg-primary）"),
				value: z.string().describe("CSS変数値（例: #ffffff）"),
			}),
		)
		.describe("CSS変数定義のリスト"),
	typography: z.object({
		fontFamily: z.string(),
		h1: z.string().describe("CSS font shorthand or size/weight"),
		h2: z.string(),
		body: z.string(),
	}),
	styleGuidelines: z
		.string()
		.describe("AIへのデザイン指示（余白の取り方、画像の扱い方など）"),
});

export type DesignSystem = z.infer<typeof designSystemSchema>;
