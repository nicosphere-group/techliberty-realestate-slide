import z from "zod";
import { SLIDE_TYPES } from "./types/slide-types";

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

export const flyerDataSchema = z.object({
	name: z.string(),
	address: z.string(),
});

export type FlyerData = z.infer<typeof flyerDataSchema>;

export class FlyerDataModel implements FlyerData {
	name: string;
	address: string;

	constructor(data: FlyerData) {
		this.name = data.name;
		this.address = data.address;
	}

	toPrompt(): string {
		return `建物名: ${this.name}\n所在地: ${this.address}`;
	}
}

// スライドタイプスキーマ（新しいスライドタイプベース）
export const slideTypeSchema = z.enum(SLIDE_TYPES);

export type { SlideType } from "./types/slide-types";

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
	slideType: slideTypeSchema.describe("このスライドのタイプ（固定テンプレート）"),
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
