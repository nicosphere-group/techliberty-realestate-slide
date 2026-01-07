import { google } from "@ai-sdk/google";
import {
	type AsyncIterableStream,
	generateText,
	Output,
	stepCountIs,
	streamText,
	type UserContent,
} from "ai";
import {
	type DesignSystem,
	designSystemSchema,
	type SlideDefinition,
	slideDefinitionSchema,
	slideResearchResultSchema,
} from "./schemas";
import type {
	Event,
	GeneratedSlide,
	ResearchSource,
	SlideInput,
	SlideResearchResult,
} from "./types";

// ========================================
// SlideGenerator Class
// ========================================

export class SlideGenerator {
	private lowModel = google("gemini-3-flash-preview");
	private highModel = google("gemini-3-pro-preview");
	private imageModel = google("gemini-3-pro-image-preview");

	/**
	 * スライド生成を実行
	 * 各ステップでイベントをyieldするジェネレーター
	 */
	async *run(input: SlideInput): AsyncGenerator<Event> {
		try {
			// 全体の開始
			yield { type: "start" };

			// Step 1: スライドのプランニング
			yield { type: "plan:start" };
			const slideDefinitions = await this.planSlides(input);
			yield { type: "plan:end", slides: slideDefinitions };

			// Step 2: 全スライド共通のデザインガイドを確定（デザイン一貫性の担保）
			const designSystem = await this.createDesignSystem(
				input,
				slideDefinitions,
			);

			// Step 3: 1ページずつ (research -> slide) を実行
			const generatedSlides: {
				slide: GeneratedSlide;
				research: SlideResearchResult;
			}[] = [];
			for (const slideDef of slideDefinitions) {
				yield {
					type: "slide:start",
					index: slideDef.pageNumber,
					title: slideDef.title,
				};

				const topics = this.getResearchTopics(slideDef);
				const research = await this.researchForSlide(slideDef, input, topics);

				yield {
					type: "slide:researching",
					index: slideDef.pageNumber,
					title: slideDef.title,
					data: research,
				};

				const slideStream = this.generateSlide(
					slideDef,
					research,
					designSystem,
					input,
				);

				const slide: GeneratedSlide = {
					html: "",
					sources: research.sources,
				};

				for await (const chunk of slideStream) {
					slide.html += chunk;

					yield {
						type: "slide:generating",
						index: slideDef.pageNumber,
						title: slideDef.title,
						data: slide,
					};
				}

				generatedSlides.push({
					slide,
					research,
				});

				yield {
					type: "slide:end",
					index: slideDef.pageNumber,
					title: slideDef.title,
					data: {
						slide,
						research,
					},
				};
			}

			// 全体の完了
			yield { type: "end", data: generatedSlides };
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
			model: this.lowModel,
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
			model: this.lowModel,
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
			model: this.lowModel,
			tools: {
				google_search: google.tools.googleSearch({}),
			},
			stopWhen: stepCountIs(6),
			system: `あなたは不動産リサーチャーです。
指定されたスライドを作成するために必要な正確な情報を探してください。

重要:
- 事実は正確に、出典を明記してください。`,
			messages: [
				{ role: "user", content: userContent },
				{
					role: "user",
					content: `# ターゲットスライド\n- タイトル: ${slide.title}\n- 概要: ${slide.description}\n- レイアウト: ${slide.layout}\n\n# 調査トピック\n${topics.join("\n")}\n\nこのスライドに必要な情報を収集してください。`,
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
			model: this.lowModel,
			system: `あなたは世界最高峰のWebデザイナーです。
HTMLとCSSを駆使して、美しく、プロフェッショナルな不動産スライドを作成してください。

# 厳守事項
1. **解像度**: 必ず \`width: 1920px; height: 1080px;\` のコンテナを作成し、その中にコンテンツを収めること。
2. **レイアウト**: 指定された \`layout\` タイプ (${definition.layout}) に最適な構図で作ること。
3. **デザインシステム**: 提供されたCSS変数をルートまたはコンテナに適用し、一貫性を保つこと。
4. **出力**: HTMLのみを出力すること（Markdownコードブロックは不要）。

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
			return `${input.content.slice(0, 500)}...`;
		}
		return "[画像入力: 物件資料]";
	}
}
