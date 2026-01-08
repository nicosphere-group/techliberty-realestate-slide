import z from "zod";

// ========================================
// Schemas
// ========================================

export const primaryInputSchema = z.object({
	customerName: z.string().min(1, "顧客名は必須です"),

	agentName: z.string().min(1, "担当者名は必須です"),
	agentPhoneNumber: z.string().optional(),
	agentEmailAddress: z.string().optional(),

	flyerFiles: z
		.instanceof(File)
		.array()
		.min(1, "少なくとも1つのマイソクが必要です"),

	// 資金計画シミュレーション用（オプション）
	annualIncome: z.number().optional().describe("年収（万円）"),
	downPayment: z.number().optional().describe("自己資金（万円）"),
	interestRate: z.number().optional().describe("想定金利（%）"),
	loanTermYears: z.number().optional().describe("返済期間（年）"),
});

export type PrimaryInput = z.infer<typeof primaryInputSchema>;

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

export const dataSourceSchema = z.enum([
	"primary", // 一次データ（マイソク、入力情報）
	"ai-generated", // AI生成
	"research", // 外部API・リサーチ
	// TODO: calculated - 現在はAIが計算しているが、将来的には入力値（年収、自己資金、金利、返済期間）を使った
	//       正確な計算ロジック（ローン返済額、諸費用など）を実装する
	"calculated", // 計算
	// TODO: static-template - 現在はAIが毎回生成しているが、将来的には固定のHTMLテンプレートに置き換える
	//       対象: スライド10（住宅ローン控除・税制情報）、スライド11（購入手続きフロー）
	"static-template", // 静的テンプレート
]);

export type DataSource = z.infer<typeof dataSourceSchema>;

export const slideDefinitionSchema = z.object({
	index: z.number().describe("スライドのページ番号（1から開始）"),
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
	dataSource: dataSourceSchema.describe(
		"このスライドの主な情報源（primary: 一次データ, ai-generated: AI生成, research: リサーチ, calculated: 計算, static-template: 静的テンプレート）",
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
					.array(z.url())
					.describe("このfactを裏付けるURL（複数可）"),
			}),
		)
		.default([]),
	sources: z
		.array(
			z.object({
				title: z.string().optional(),
				url: z.url(),
				excerpt: z.string().optional(),
			}),
		)
		.default([]),
});

export const designSystemSchema = z.object({
	themeName: z.string().describe("デザインテーマの名前（例: Modern Luxury）"),
	colorPalette: z
		.object({
			primary: z.string().describe("プライマリーカラー (HEX)"),
			secondary: z.string().describe("セカンダリーカラー (HEX)"),
			accent: z.string().describe("アクセントカラー (HEX)"),
			background: z.string().describe("背景色 (HEX)"),
			surface: z.string().describe("カードなどの表面色 (HEX)"),
			text: z.string().describe("基本テキスト色 (HEX)"),
		})
		.describe("カラーパレット定義"),
	typography: z
		.object({
			fontFamily: z
				.string()
				.describe("フォントファミリー設定 (例: 'Noto Sans JP', sans-serif)"),
		})
		.describe("タイポグラフィ設定"),
	commonClasses: z
		.object({
			slideBackground: z
				.string()
				.describe("スライド背景のクラス (例: bg-[#f0f0f0] text-[#333])"),
			h1: z.string().describe("スライドタイトル(H1)用クラス"),
			h2: z.string().describe("セクションタイトル(H2)用クラス"),
			h3: z.string().describe("小見出し(H3)用クラス"),
			body: z.string().describe("本文用クラス"),
			caption: z.string().describe("注釈・キャプション用クラス"),
			card: z.string().describe("情報カードのコンテナクラス"),
		})
		.describe("要素ごとに適用すべきTailwindユーティリティクラスのセット"),
	styleGuidelines: z
		.string()
		.describe("AIへのデザイン指示（レイアウトのコツ、画像の配置ルールなど）"),
});

export type DesignSystem = z.infer<typeof designSystemSchema>;
