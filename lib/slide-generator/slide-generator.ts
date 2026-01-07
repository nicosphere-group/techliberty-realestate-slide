import { google } from "@ai-sdk/google";
import {
	type AsyncIterableStream,
	generateText,
	type ModelMessage,
	Output,
	stepCountIs,
	streamText,
	type UserContent,
} from "ai";
import {
	type DesignSystem,
	designSystemSchema,
	type PrimaryInput,
	type SlideDefinition,
	slideDefinitionSchema,
	slideResearchResultSchema,
} from "./schemas";
import type {
	Event,
	GeneratedSlide,
	ResearchSource,
	SlideResearchResult,
} from "./types";

// ========================================
// SlideGenerator Class
// ========================================

export class SlideGenerator {
	// private lowModel = google("gemini-2.5-flash-lite");
	private middleModel = google("gemini-3-flash-preview");
	// private highModel = google("gemini-3-pro-preview");
	// private imageModel = google("gemini-3-pro-image-preview");
	private messages: ModelMessage[] = [];

	private template(body: string, designSystem: DesignSystem): string {
		const themeCss = `@theme {
        --color-primary: ${designSystem.colorPalette.primary};
        --color-secondary: ${designSystem.colorPalette.secondary};
        --color-accent: ${designSystem.colorPalette.accent};
        --color-background: ${designSystem.colorPalette.background};
        --color-surface: ${designSystem.colorPalette.surface};
        --color-text: ${designSystem.colorPalette.text};
        --font-sans: ${designSystem.typography.fontFamily};
      }`;

		return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
      ${themeCss}
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
	}

	/**
	 * スライド生成を実行
	 * 各ステップでイベントをyieldするジェネレーター
	 */
	async *run(input: PrimaryInput): AsyncGenerator<Event> {
		try {
			// 全体の開始
			yield { type: "start" };

			// 入力をコンテキストに追加
			const userContent = await this.buildUserContent(input);
			this.messages.push({ role: "user", content: userContent });

			// 与えられた画像から埋め込み画像を抽出
			// const flyerImage = await input.flyerFiles[0].arrayBuffer();
			// const embeddedImages = await this.extractEmbeddedImages(flyerImage);

			// Step 1: スライドのプランニング
			yield { type: "plan:start" };
			const plan = await this.createPlan();
			yield { type: "plan:end", plan: plan };

			// Step 2: 全スライド共通のデザインガイドを確定（デザイン一貫性の担保）
			const designSystem = await this.createDesignSystem(plan);

			// Step 3: 1ページずつ (research -> slide) を実行
			const generatedSlides: {
				slide: GeneratedSlide;
				research: SlideResearchResult;
			}[] = [];
			for (const slideDef of plan) {
				yield {
					type: "slide:start",
					index: slideDef.index,
					title: slideDef.title,
				};

				const topics = this.getResearchTopics(slideDef);
				const research = await this.researchForSlide(slideDef, topics);

				yield {
					type: "slide:researching",
					index: slideDef.index,
					title: slideDef.title,
					data: research,
				};

				const slideStream = this.generateSlide(
					slideDef,
					research,
					designSystem,
				);

				const slide: GeneratedSlide = {
					html: "",
					sources: research.sources,
				};

				let bodyContent = "";

				for await (const chunk of slideStream) {
					bodyContent += chunk;
					slide.html = this.template(bodyContent, designSystem);

					yield {
						type: "slide:generating",
						index: slideDef.index,
						title: slideDef.title,
						data: { ...slide },
					};
				}

				generatedSlides.push({
					slide,
					research,
				});

				yield {
					type: "slide:end",
					index: slideDef.index,
					title: slideDef.title,
					data: {
						slide: { ...slide },
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

	// 	private async extractEmbeddedImages(
	// 		image: ArrayBuffer,
	// 	): Promise<ArrayBuffer[]> {
	// 		const { files } = await generateText({
	// 			model: this.imageModel,
	// 			system: `あなたは高度な画像解析AIです。
	// 与えられた画像から、有用な埋め込み画像をすべて抽出してください。
	// 抽出した画像はそれぞれ別々のファイルとして出力してください。`,
	// 			messages: [
	// 				{
	// 					role: "user",
	// 					content: [
	// 						{
	// 							type: "image",
	// 							image,
	// 						},
	// 					],
	// 				},
	// 			],
	// 		});
	//
	// 		return files.map((f) => f.uint8Array.buffer as ArrayBuffer);
	// 	}

	/**
	 * Step 2: スライドの構成をプランニング
	 */
	private async createPlan(): Promise<SlideDefinition[]> {
		const { output } = await generateText({
			model: this.middleModel,
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
				...this.messages,
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
		plan: SlideDefinition[],
	): Promise<DesignSystem> {
		const { output } = await generateText({
			model: this.middleModel,
			system: `あなたは世界的なアートディレクターです。
高級不動産のプレゼンテーションにふさわしい、洗練されたデザインシステムを定義してください。

要件:
- **1920x1080** の画面サイズに最適化されたタイポグラフィ
- **可読性**と**高級感**の両立
- Tailwind CSS v4のクラス構成を前提とする
- 色彩はカラーパレットとして定義する (HEXコード)
- フォントはシステムフォントまたはGoogle Fontsの一般的なもの (文字列指定)

各要素に対して、推奨されるTailwindユーティリティクラス（commonClasses）を定義してください。`,
			messages: [
				...this.messages,
				{
					role: "user",
					content: `以下のスライドプランに基づき、全スライドで共通利用するデザインシステムを作成してください。\n\n${plan
						.map(
							(s) =>
								`- スライド ${s.index}: "${s.title}" (${s.layout}) - ${s.description}`,
						)
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
		slideDef: SlideDefinition,
		topics: string[],
	): Promise<SlideResearchResult> {
		const { output } = await generateText({
			model: this.middleModel,
			tools: {
				google_search: google.tools.googleSearch({}),
			},
			stopWhen: stepCountIs(6),
			system: `あなたは不動産リサーチャーです。
指定されたスライドを作成するために必要な正確な情報を探してください。

重要:
- 事実は正確に、出典を明記してください。`,
			messages: [
				...this.messages,
				{
					role: "user",
					content: `# ターゲットスライド\n- タイトル: ${slideDef.title}\n- 概要: ${slideDef.description}\n- レイアウト: ${slideDef.layout}\n\n# 調査トピック\n${topics.join("\n")}\n\nこのスライドに必要な情報を収集してください。`,
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
	): AsyncIterableStream<string> {
		this.messages.push({
			role: "user",
			content: `
# スライド定義
- タイトル: ${definition.title}
- 概要: ${definition.description}
- レイアウト: ${definition.layout}

# デザインシステム
## カラーパレット
${JSON.stringify(designSystem.colorPalette, null, 2)}

## 共通クラス (Tailwind)
${JSON.stringify(designSystem.commonClasses, null, 2)}

## タイポグラフィ
${JSON.stringify(designSystem.typography, null, 2)}

# リサーチ結果
${JSON.stringify(research)}

上記の要素を組み合わせて、1枚のスライドの**bodyタグ内部のHTMLのみ**を出力してください。
ルート要素は \`<div id="slide-container" class="..." style="...">\` とし、Tailwind CSSクラスを使用してスタイリングしてください。
カラーパレットは既にCSS変数として定義されています（例: \`bg-primary\`, \`text-accent\` が使用可能）。
共通クラス (\`commonClasses\`) を積極的に活用し、デザインの一貫性を保ってください。
`,
		});

		const { response, textStream } = streamText({
			model: this.middleModel,
			system: `あなたは世界最高峰のWebデザイナーです。
Tailwind CSSを駆使して、美しく、プロフェッショナルな不動産スライドを作成してください。

# 厳守事項
1. **解像度**: ルート要素の \`id="slide-container"\` には \`w-[1920px] h-[1080px] overflow-hidden relative\` などのクラスを適用し、サイズを固定すること。
2. **レイアウト**: 指定された \`layout\` タイプ (${definition.layout}) に最適な構図で作ること。
3. **デザインシステム**: 提供された共通クラス (\`commonClasses\`) を可能な限り使用すること。色は \`bg-primary\` などのテーマクラスを使用すること。
4. **出力**: HTMLの \`<body>\` タグの**中身のみ**を出力すること。\`: \`<html>\`, \`<head>\`, \`<body>\` タグ自体は含めないでください。Markdownコードブロックも不要です。

# デザインガイドライン
${designSystem.styleGuidelines}
`,
			messages: this.messages,
		});

		response.then(({ messages }) => this.messages.push(...messages));

		return textStream;
	}

	private async buildUserContent(input: PrimaryInput): Promise<UserContent> {
		const userContent: UserContent = [];

		// チラシ画像を追加
		const flyerFile = input.flyerFiles[0];

		userContent.push(
			{ type: "image", image: await flyerFile.arrayBuffer() },
			{
				type: "text",
				text: "上記の画像は不動産物件のチラシです。記載されている全ての情報（物件名、価格、所在地、面積、間取り、特徴、設備、アクセス情報など）を詳細に抽出してください。",
			},
		);

		// テキスト情報を構造化して追加
		const textParts: string[] = [];

		textParts.push(`# 顧客情報`);
		textParts.push(`- 顧客名: ${input.customerName}`);

		textParts.push(`\n# 担当者情報`);
		textParts.push(`- 担当者名: ${input.agentName}`);
		if (input.agentPhoneNumber) {
			textParts.push(`- 電話番号: ${input.agentPhoneNumber}`);
		}
		if (input.agentEmailAddress) {
			textParts.push(`- メールアドレス: ${input.agentEmailAddress}`);
		}

		userContent.push({
			type: "text",
			text: textParts.join("\n"),
		});

		return userContent;
	}
}
