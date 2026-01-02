import { google } from "@ai-sdk/google";
import {
	type AsyncIterableStream,
	generateText,
	Output,
	stepCountIs,
	streamText,
	type UserContent,
} from "ai";
import { z } from "zod";

// ========================================
// Types
// ========================================

/** 入力タイプ: テキストまたは画像 */
export type SlideInput =
	| { type: "text"; content: string }
	| { type: "image"; data: Buffer; mimeType: string };

/** 生成されたスライド */
export interface GeneratedSlide {
	pageNumber: number;
	html: string;
	sources?: ResearchSource[];
}

/** リサーチの情報源 */
export interface ResearchSource {
	title?: string;
	url: string;
	excerpt?: string;
}

/** スライドに利用する画像候補 */
export interface ResearchImage {
	imageUrl: string;
	pageUrl: string;
	alt?: string;
	title?: string;
	license?: string;
	attribution?: string;
}

/** スライド単位のリサーチ結果 */
export interface SlideResearchResult {
	summary: string;
	keyFacts: Array<{ fact: string; sourceUrls: string[] }>;
	sources: ResearchSource[];
	images: ResearchImage[];
}

/** ジェネレーターから返されるイベント */
export type SlideGeneratorEvent =
	| { type: "start" }
	| { type: "planning:start" }
	| { type: "planning:end"; slides: SlideDefinition[] }
	| {
			type: "research:start";
			pageNumber: number;
			title: string;
			topics: string[];
	  }
	| {
			type: "research:end";
			pageNumber: number;
			title: string;
			research: SlideResearchResult;
	  }
	| { type: "slide:start"; pageNumber: number; title: string }
	| {
			type: "slide:generating";
			pageNumber: number;
			title: string;
			html: string;
	  }
	| { type: "slide:end"; slide: GeneratedSlide; research: SlideResearchResult }
	| { type: "end"; slides: GeneratedSlide[] }
	| { type: "error"; message: string };

// ========================================
// Schemas
// ========================================

const slideLayoutSchema = z.enum([
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

const slideDefinitionSchema = z.object({
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

const slideResearchResultSchema = z.object({
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
	images: z
		.array(
			z.object({
				imageUrl: z.string().url().describe("直接参照できる画像URL"),
				pageUrl: z.string().url().describe("画像の掲載ページURL（出典）"),
				alt: z.string().optional(),
				title: z.string().optional(),
				license: z
					.string()
					.optional()
					.describe("可能ならライセンス/利用条件（例: Unsplash License）"),
				attribution: z
					.string()
					.optional()
					.describe("可能ならクレジット表記（例: Photo by ...）"),
			}),
		)
		.default([])
		.describe(
			"スライドに使える画像候補。著作権/利用条件が明確で再利用しやすいものを優先",
		),
});

const designSystemSchema = z.object({
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

type DesignSystem = z.infer<typeof designSystemSchema>;

// ========================================
// SlideGenerator Class
// ========================================

export class SlideGenerator {
	private model = google("gemini-3-flash-preview");

	/**
	 * スライド生成を実行
	 * 各ステップでイベントをyieldするジェネレーター
	 */
	async *run(input: SlideInput): AsyncGenerator<SlideGeneratorEvent> {
		try {
			// 全体の開始
			yield { type: "start" };

			// Step 1: スライドのプランニング
			yield { type: "planning:start" };
			const slideDefinitions = await this.planSlides(input);
			yield { type: "planning:end", slides: slideDefinitions };

			// Step 2: 全スライド共通のデザインガイドを確定（デザイン一貫性の担保）
			const designSystem = await this.createDesignSystem(
				input,
				slideDefinitions,
			);

			// Step 3: 1ページずつ (research -> slide) を実行
			const generatedSlides: GeneratedSlide[] = [];
			for (const slideDef of slideDefinitions) {
				const topics = this.getResearchTopics(slideDef);
				yield {
					type: "research:start",
					pageNumber: slideDef.pageNumber,
					title: slideDef.title,
					topics,
				};

				const research = await this.researchForSlide(slideDef, input, topics);
				yield {
					type: "research:end",
					pageNumber: slideDef.pageNumber,
					title: slideDef.title,
					research,
				};

				yield {
					type: "slide:start",
					pageNumber: slideDef.pageNumber,
					title: slideDef.title,
				};

				const slideStream = this.generateSlide(
					slideDef,
					research,
					designSystem,
					input,
				);

				const slide: GeneratedSlide = {
					pageNumber: slideDef.pageNumber,
					html: "",
					sources: research.sources,
				};

				for await (const chunk of slideStream) {
					slide.html += chunk;

					yield {
						type: "slide:generating",
						pageNumber: slideDef.pageNumber,
						title: slideDef.title,
						html: slide.html,
					};
				}

				generatedSlides.push(slide);

				yield { type: "slide:end", slide, research };
			}

			// 全体の完了
			yield { type: "end", slides: generatedSlides };
		} catch (error) {
			yield {
				type: "error",
				message: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Step 2: スライドの構成をプランニング
	 */
	private async planSlides(input: SlideInput): Promise<SlideDefinition[]> {
		const userContent = this.buildUserContent(input);

		const { output } = await generateText({
			model: this.model,
			system: `あなたは不動産プレゼンテーション資料の構成作家です。
提供された情報を分析し、論理的で説得力のあるスライド構成を設計してください。

構成のガイドライン:
1. **タイトルスライド**: 物件名と魅力的なキャッチコピー
2. **物件概要**: 基本情報（価格、所在地、面積など）を明確に
3. **特徴・魅力**: 複数のスライドに分けても良い。写真映えするレイアウトを選ぶ
4. **周辺環境**: 地図やアクセス情報
5. **間取り・設備**: 具体的な生活イメージ
6. **投資価値/まとめ**: クロージング
7. **お問い合わせ**: 連絡先

各スライドには最適な \`layout\` タイプを選択してください。`,
			messages: [
				{
					role: "user",
					content: userContent,
				},
				{
					role: "user",
					content:
						"上記の情報を分析し、全5-8枚程度のスライド構成を設計してください。",
				},
			],
			output: Output.object({
				name: "slide_plan",
				description: "生成されたスライドのプラン",
				schema: slideDefinitionSchema.array(),
			}),
		});

		return output;
	}

	/**
	 * Step 2.5: 全スライドで共通利用するデザインガイドを生成
	 */
	private async createDesignSystem(
		input: SlideInput,
		slides: SlideDefinition[],
	): Promise<DesignSystem> {
		const { output } = await generateText({
			model: this.model,
			system: `あなたは世界的なアートディレクターです。
高級不動産のプレゼンテーションにふさわしい、洗練されたデザインシステムを作成してください。

要件:
- **1920x1080** の画面サイズに最適化されたタイポグラフィとスペーシング
- **可読性**と**高級感**の両立
- CSS変数を活用し、実装しやすい定義にする
- フォントはシステムフォントスタックを使用するが、モダンなものを選ぶ

出力するCSS変数の例:
- --bg-primary, --bg-secondary
- --text-primary, --text-muted
- --accent-color
- --spacing-sm, --spacing-md, --spacing-lg
- --font-title, --font-body`,
			messages: [
				{
					role: "user",
					content: `# 元データ概要\n${this.getInputSummary(input)}\n\n# スライド構成\n${slides
						.map((s) => `- [${s.layout}] ${s.title}`)
						.join("\n")}`,
				},
			],
			output: Output.object({
				name: "design_system",
				description: "全スライド共通のデザインシステム",
				schema: designSystemSchema,
			}),
		});

		return output;
	}

	/**
	 * Step 3a: リサーチ
	 */
	private async researchForSlide(
		slide: SlideDefinition,
		input: SlideInput,
		topics: string[],
	): Promise<SlideResearchResult> {
		const userContent = this.buildUserContent(input);
		const { output } = await generateText({
			model: this.model,
			tools: {
				google_search: google.tools.googleSearch({}),
			},
			stopWhen: stepCountIs(6),
			system: `あなたは不動産リサーチャーです。
指定されたスライドを作成するために必要な正確な情報と、視覚的に魅力的な画像を探してください。

重要:
- 画像はスライドのクオリティを左右します。高画質で、内容に合致するものを優先してください。
- 事実は正確に、出典を明記してください。`,
			messages: [
				{ role: "user", content: userContent },
				{
					role: "user",
					content: `# ターゲットスライド\n- タイトル: ${slide.title}\n- 概要: ${slide.description}\n- レイアウト: ${slide.layout}\n\n# 調査トピック\n${topics.join("\n")}\n\nこのスライドに必要な情報と画像を収集してください。`,
				},
			],
			output: Output.object({
				name: "slide_research",
				description: "スライド単位のリサーチ結果",
				schema: slideResearchResultSchema,
			}),
		});

		return {
			summary: output.summary,
			keyFacts: output.keyFacts,
			sources: this.dedupeSources(output.sources),
			images: this.dedupeImages(output.images),
		};
	}

	private getResearchTopics(slideDef: SlideDefinition): string[] {
		const topics = slideDef.researchTopics ?? slideDef.contentHints;
		const deduped = Array.from(
			new Set(topics.map((t) => t.trim()).filter(Boolean)),
		);
		if (deduped.length > 0) return deduped;
		return [slideDef.title, slideDef.description];
	}

	private dedupeSources(sources: ResearchSource[]): ResearchSource[] {
		const seen = new Set<string>();
		const out: ResearchSource[] = [];
		for (const source of sources) {
			const url = source.url.trim();
			if (!url) continue;
			if (seen.has(url)) continue;
			seen.add(url);
			out.push({ ...source, url });
		}
		return out;
	}

	private dedupeImages(images: ResearchImage[]): ResearchImage[] {
		const seen = new Set<string>();
		const out: ResearchImage[] = [];
		for (const image of images) {
			const imageUrl = image.imageUrl.trim();
			if (!imageUrl) continue;
			if (seen.has(imageUrl)) continue;
			seen.add(imageUrl);
			out.push(image);
		}
		return out;
	}

	/**
	 * Step 3b: スライド生成
	 */
	private generateSlide(
		definition: SlideDefinition,
		research: SlideResearchResult,
		designSystem: DesignSystem,
		input: SlideInput,
	): AsyncIterableStream<string> {
		// CSS変数の文字列化
		const cssVarsString = designSystem.cssVariables
			.map((v) => `${v.key}: ${v.value};`)
			.join("\n");

		const { textStream } = streamText({
			model: this.model,
			system: `あなたは世界最高峰のWebデザイナーです。
HTMLとCSSを駆使して、美しく、プロフェッショナルな不動産スライドを作成してください。

# 厳守事項
1. **解像度**: 必ず \`width: 1920px; height: 1080px;\` のコンテナを作成し、その中にコンテンツを収めること。
2. **レイアウト**: 指定された \`layout\` タイプ (${definition.layout}) に最適な構図で作ること。
3. **デザインシステム**: 提供されたCSS変数をルートまたはコンテナに適用し、一貫性を保つこと。
4. **画像**: リサーチ結果の画像を最大限活用すること。画像がない場合はプレースホルダーを使用せず、美しいタイポグラフィで構成すること。
5. **出力**: HTMLのみを出力すること（Markdownコードブロックは不要）。

# コンテナの基本スタイル（参考）
\`\`\`css
.slide-container {
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  position: relative;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: ${designSystem.typography.fontFamily};
}
\`\`\`

# デザインガイドライン
${designSystem.styleGuidelines}
`,
			messages: [
				{
					role: "user",
					content: `
# スライド定義
- タイトル: ${definition.title}
- 概要: ${definition.description}
- レイアウト: ${definition.layout}

# デザインシステム (CSS Variables)
${cssVarsString}

# リサーチ結果
${JSON.stringify(research)}

# 元データ概要
${this.getInputSummary(input)}

上記の要素を組み合わせて、1枚の完成されたHTMLスライドを出力してください。
ルート要素は \`<div class="slide-container" style="...">\` とし、インラインスタイルまたは \`<style>\` タグを使ってスタイリングしてください。
`,
				},
			],
		});

		return textStream;
	}

	private buildUserContent(input: SlideInput): UserContent {
		if (input.type === "text") {
			return input.content;
		}
		return [
			{ type: "image", image: input.data },
			{
				type: "text",
				text: "この画像は不動産物件の資料です。内容を詳細に分析してください。",
			},
		];
	}

	private getInputSummary(input: SlideInput): string {
		if (input.type === "text") {
			return input.content.slice(0, 500) + "...";
		}
		return "[画像入力: 物件資料]";
	}
}
