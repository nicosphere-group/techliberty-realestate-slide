import { google } from "@ai-sdk/google";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PlacesClient } from "@googlemaps/places";
import { RoutesClient } from "@googlemaps/routing";
// import { PlacesClient } from "@googlemaps/places";
import {
	type AsyncIterableStream,
	generateText,
	type ModelMessage,
	Output,
	stepCountIs,
	streamText,
	tool,
	type UserContent,
} from "ai";
import ky from "ky";
import * as math from "mathjs";
import z from "zod";
import { HazardMapGenerator, hazardMapOptionsSchema } from "@/lib/hazard-map";
import { type AppraisalReportParams, ReinfoClient } from "@/lib/reinfo";
import { AsyncQueue } from "./async-queue";
import {
	type DesignSystem,
	designSystemSchema,
	FlyerDataModel,
	flyerDataSchema,
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
	UsageInfo,
} from "./types";

const client = new S3Client({
	endpoint: "https://rdicyprpgreghjslbdts.storage.supabase.co/storage/v1/s3",
});
const hazardMapGenerator = new HazardMapGenerator();
const reinfoClient = new ReinfoClient({
	apiKey: process.env.REINFO_API_KEY ?? "",
});
const placesClient = new PlacesClient({
	apiKey: process.env.GOOGLE_MAPS_API_KEY,
});
const routesClient = new RoutesClient({
	apiKey: process.env.GOOGLE_MAPS_API_KEY,
});

// ========================================
// SlideGenerator Class
// ========================================

export type ModelType = "low" | "middle" | "high";

export interface SlideGeneratorOptions {
	modelType?: ModelType;
	parallel?: boolean;
}

// デフォルトのオプション
const defaultOptions = {
	modelType: "middle",
	parallel: true,
} satisfies SlideGeneratorOptions;

export class SlideGenerator {
	private model;
	private parallel;
	private messages: ModelMessage[] = [];

	constructor(options: SlideGeneratorOptions = {}) {
		switch (options.modelType || defaultOptions.modelType) {
			case "low":
				this.model = google("gemini-2.5-flash-lite");
				break;
			case "middle":
				this.model = google("gemini-3-flash-preview");
				break;
			case "high":
				this.model = google("gemini-3-pro-preview");
				break;
			default:
				throw new Error(`Unsupported model type: ${options.modelType}`);
		}
		this.parallel = options.parallel ?? defaultOptions.parallel;
	}

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

			// マイソクからデータを抽出
			const flyerData = await this.extractFlyerData(input.flyerFiles[0]);
			this.messages.push({
				role: "user",
				content: `以下は、提供されたマイソクから抽出されたデータです:\n${flyerData.toPrompt()}`,
			});

			// 与えられた画像から埋め込み画像を抽出
			// const flyerImage = await input.flyerFiles[0].arrayBuffer();
			// const embeddedImages = await this.extractEmbeddedImages(flyerImage);

			// Step 1: スライドのプランニング
			yield { type: "plan:start" };
			const { plan, usage: planUsage } = await this.createPlan();
			yield { type: "plan:end", plan: plan };
			yield { type: "usage", usage: planUsage, step: "plan" };

			// Step 2: 全スライド共通のデザインガイドを確定（デザイン一貫性の担保）
			const { designSystem, usage: designUsage } =
				await this.createDesignSystem(plan);
			yield { type: "usage", usage: designUsage, step: "design" };

			// Step 3: 1ページずつ (research -> slide) を実行
			const generatedSlides: {
				slide: GeneratedSlide;
				research: SlideResearchResult;
			}[] = [];
			if (this.parallel) {
				const channel = new AsyncQueue<Event>();
				const promises = Promise.all(
					plan.map(async (slideDef) => {
						channel.push({
							type: "slide:start",
							index: slideDef.index,
							title: slideDef.title,
						});

						// dataSource が "research" の場合のみリサーチを実行
						let research: SlideResearchResult;
						if (slideDef.dataSource === "research") {
							const topics = this.getResearchTopics(slideDef);
							const { research: researchResult, usage: researchUsage } =
								await this.researchForSlide(slideDef, topics);
							research = researchResult;
							channel.push({
								type: "usage",
								usage: researchUsage,
								step: `research-${slideDef.index}`,
							});
						} else {
							// リサーチ不要の場合は空のリサーチ結果を使用
							research = {
								summary: "",
								keyFacts: [],
								sources: [],
							};
						}

						// TODO: dataSource による分岐処理を追加
						// - "calculated": 入力値（年収、自己資金、金利、返済期間）から正確な計算を行い、結果をスライド生成に渡す
						// - "static-template": 固定のHTMLテンプレートを返し、AI生成をスキップする

						channel.push({
							type: "slide:researching",
							index: slideDef.index,
							title: slideDef.title,
							data: research,
						});

						let slide: GeneratedSlide;

						// マイソクスライド: AI生成をスキップし、アップロード画像をそのまま表示
						if (
							slideDef.dataSource === "primary" &&
							slideDef.layout === "full-image"
						) {
							const imageDataUrls = await this.filesToDataUrls(
								input.flyerFiles,
							);
							const bodyContent = this.createMaisokuSlideHtml(
								imageDataUrls,
								designSystem,
							);
							slide = {
								html: this.template(bodyContent, designSystem),
								sources: [],
							};

							channel.push({
								type: "slide:generating",
								index: slideDef.index,
								title: slideDef.title,
								data: { ...slide },
							});
						} else {
							// 通常のAI生成フロー
							const { textStream, getUsage } = this.generateSlide(
								slideDef,
								research,
								designSystem,
							);

							slide = {
								html: "",
								sources: research.sources,
							};

							let bodyContent = "";

							for await (const chunk of textStream) {
								bodyContent += chunk;
								slide.html = this.template(bodyContent, designSystem);

								channel.push({
									type: "slide:generating",
									index: slideDef.index,
									title: slideDef.title,
									data: { ...slide },
								});
							}

							// スライド生成完了後にusageを取得
							const slideUsage = await getUsage();
							channel.push({
								type: "usage",
								usage: slideUsage,
								step: `slide-${slideDef.index}`,
							});
						}

						generatedSlides.push({
							slide,
							research,
						});

						channel.push({
							type: "slide:end",
							index: slideDef.index,
							title: slideDef.title,
							data: {
								slide: { ...slide },
								research,
							},
						});
					}),
				);
				promises.then(() => channel.close());
				promises.catch(() => channel.close());
				for await (const event of channel) {
					yield event;
				}
				await promises;
			} else {
				for (const slideDef of plan) {
					yield {
						type: "slide:start",
						index: slideDef.index,
						title: slideDef.title,
					};

					// dataSource が "research" の場合のみリサーチを実行
					let research: SlideResearchResult;
					if (slideDef.dataSource === "research") {
						const topics = this.getResearchTopics(slideDef);
						const { research: researchResult, usage: researchUsage } =
							await this.researchForSlide(slideDef, topics);
						research = researchResult;
						yield {
							type: "usage",
							usage: researchUsage,
							step: `research-${slideDef.index}`,
						};
					} else {
						// リサーチ不要の場合は空のリサーチ結果を使用
						research = {
							summary: "",
							keyFacts: [],
							sources: [],
						};
					}

					// TODO: dataSource による分岐処理を追加
					// - "calculated": 入力値（年収、自己資金、金利、返済期間）から正確な計算を行い、結果をスライド生成に渡す
					// - "static-template": 固定のHTMLテンプレートを返し、AI生成をスキップする

					yield {
						type: "slide:researching",
						index: slideDef.index,
						title: slideDef.title,
						data: research,
					};

					let slide: GeneratedSlide;

					// マイソクスライド: AI生成をスキップし、アップロード画像をそのまま表示
					if (
						slideDef.dataSource === "primary" &&
						slideDef.layout === "full-image"
					) {
						const imageDataUrls = await this.filesToDataUrls(input.flyerFiles);
						const bodyContent = this.createMaisokuSlideHtml(
							imageDataUrls,
							designSystem,
						);
						slide = {
							html: this.template(bodyContent, designSystem),
							sources: [],
						};

						yield {
							type: "slide:generating",
							index: slideDef.index,
							title: slideDef.title,
							data: { ...slide },
						};
					} else {
						// 通常のAI生成フロー
						const { textStream, getUsage } = this.generateSlide(
							slideDef,
							research,
							designSystem,
						);

						slide = {
							html: "",
							sources: research.sources,
						};

						let bodyContent = "";

						for await (const chunk of textStream) {
							bodyContent += chunk;
							slide.html = this.template(bodyContent, designSystem);

							yield {
								type: "slide:generating",
								index: slideDef.index,
								title: slideDef.title,
								data: { ...slide },
							};
						}

						// スライド生成完了後にusageを取得
						const slideUsage = await getUsage();
						yield {
							type: "usage",
							usage: slideUsage,
							step: `slide-${slideDef.index}`,
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
	 * Step 1: マイソクからデータを抽出
	 */
	private async extractFlyerData(flyerFile: File): Promise<FlyerDataModel> {
		const { output } = await generateText({
			model: this.model,
			system: `あなたは不動産マイソク解析の専門家です。
提供されたマイソク画像から、以下の情報を正確に抽出してください:
- 建物名
- 所在地
`,
			messages: [
				{
					role: "user",
					content: [
						{ type: "image", image: await flyerFile.arrayBuffer() },
						{
							type: "text",
							text: "上記の画像は不動産物件のチラシです。記載されている全ての情報（物件名、価格、所在地、面積、間取り、特徴、設備、アクセス情報など）を詳細に抽出してください。",
						},
					],
				},
			],
			output: Output.object({
				name: "flyer_data",
				description: "マイソクから抽出されたデータ",
				schema: flyerDataSchema,
			}),
		});

		return new FlyerDataModel(output);
	}

	/**
	 * Step 2: スライドの構成をプランニング
	 */
	private async createPlan(): Promise<{
		plan: SlideDefinition[];
		usage: UsageInfo;
	}> {
		const { output, usage } = await generateText({
			model: this.model,
			system: `あなたは不動産プレゼンテーション資料の構成作家です。
提供された情報を分析し、以下の**12枚構成**でスライドを設計してください。

# スライド構成（必須・12枚）

## スライド1: タイトル
- layout: "title"
- dataSource: "primary"
- **内容**: 物件名、顧客名、作成日（本日の日付）、担当者名・連絡先
- **情報源**: マイソク + 入力された顧客情報・担当者情報

## スライド2: 物件ハイライト
- layout: "three-column"
- dataSource: "ai-generated"
- **内容**: 物件の推しポイント3点（価格・面積・築年・最寄駅・間取り等から抽出）
- **情報源**: マイソクからAI生成
- **注意**: 景表法に抵触する表現は避ける

## スライド3: 間取り詳細
- layout: "content-left"
- dataSource: "ai-generated"
- **内容**: 間取り図、部屋の使い方提案、動線コメント、採光・眺望コメント
- **情報源**: マイソクの間取り情報からAI生成

## スライド4: アクセス情報
- layout: "content-right"
- dataSource: "research"
- **内容**: 最寄駅情報、主要駅への所要時間、路線図イメージ
- **情報源**: マイソク + 交通情報（リサーチで補完）

## スライド5: 周辺環境
- layout: "grid"
- dataSource: "research"
- **内容**: 周辺施設一覧（スーパー、コンビニ、公園、病院）、周辺地図
- **情報源**: 物件住所からPOI検索（リサーチで補完）

## スライド6: 価格分析
- layout: "data-focus"
- dataSource: "research"
- **内容**: 周辺相場比較、価格分析コメント
- **情報源**: 不動産相場データ + AI分析

## スライド7: 災害リスク
- layout: "content-right"
- dataSource: "research"
- **内容**: ハザードマップ情報、災害リスクコメント（洪水・土砂災害・高潮等）
- **情報源**: 国土交通省ハザードマップポータル（リサーチで補完）

## スライド8: 資金計画シミュレーション
- layout: "data-focus"
- dataSource: "calculated"
- **内容**: 月々返済額、総返済額、借入可能額の試算
- **情報源**: 物件価格から計算

## スライド9: 諸費用一覧
- layout: "data-focus"
- dataSource: "calculated"
- **内容**: 仲介手数料、登記費用、火災保険等の概算
- **情報源**: 物件価格から計算

## スライド10: 住宅ローン控除・税制情報
- layout: "content-left"
- dataSource: "static-template"
- **内容**: 住宅ローン控除の概要、適用条件、節税効果
- **情報源**: 一般的な税制情報（静的テンプレート）

## スライド11: 購入手続きフロー
- layout: "section"
- dataSource: "static-template"
- **内容**: 申込→契約→決済の標準フロー図解
- **情報源**: 標準フロー（静的テンプレート）

## スライド12: マイソク
- layout: "full-image"
- dataSource: "primary"
- **内容**: マイソク画像をそのまま表示
- **情報源**: 入力されたマイソク画像

# 景表法コンプライアンス（重要）
以下の表現は**絶対に使用しないでください**：
- 断定表現: 絶対、必ず、間違いなく、完全、完璧、万全
- 裏付けのない表現: 日本一、業界初、世界一、地域No.1、地域最大級
- 確約できない表現: 特選、厳選、最高、最高値
- 期日をコミットする表現: 即座に、即売れ
- 他社への誹謗中傷
- おとり表現: 購入希望者がいます
- 過度な特別感: 今だけ、期間限定

# 出力形式
各スライドには以下を必ず含めてください:
- index: スライド番号（1-12）
- layout: 指定されたレイアウト
- title: スライドタイトル
- description: 内容の概要
- contentHints: 含めるべき具体的なコンテンツ
- researchTopics: dataSourceが"research"の場合の調査トピック
- dataSource: 情報源タイプ（リサーチ要否はこれで判断）`,
			messages: [
				...this.messages,
				{
					role: "user",
					content:
						"上記の情報を分析し、全12枚のスライド構成を設計してください。各スライドには具体的なcontentHints、researchTopics、dataSourceを含めてください。",
				},
			],
			output: Output.object({
				name: "slide_plan",
				description: "生成されたスライドのプラン",
				schema: slideDefinitionSchema.array(),
			}),
		});

		return {
			plan: output,
			usage: {
				promptTokens: usage.inputTokens ?? 0,
				completionTokens: usage.outputTokens ?? 0,
				totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
			},
		};
	}

	/**
	 * Step 2.5: 全スライドで共通利用するデザインガイドを生成
	 */
	private async createDesignSystem(
		plan: SlideDefinition[],
	): Promise<{ designSystem: DesignSystem; usage: UsageInfo }> {
		const { output, usage } = await generateText({
			model: this.model,
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

		return {
			designSystem: output,
			usage: {
				promptTokens: usage.inputTokens ?? 0,
				completionTokens: usage.outputTokens ?? 0,
				totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
			},
		};
	}

	/**
	 * Step 3a: リサーチ
	 */
	private async researchForSlide(
		slideDef: SlideDefinition,
		topics: string[],
	): Promise<{ research: SlideResearchResult; usage: UsageInfo }> {
		const { output, usage } = await generateText({
			model: this.model,
			tools: {
				google_search: google.tools.googleSearch({}),
				google_places_text_search: tool({
					description:
						"Google Places Text Searchで住所・施設を検索し、候補の基本情報（名称、住所、座標）を取得します。",
					inputSchema: z.object({
						query: z.string().min(1).describe("検索クエリ（住所や施設名）"),
						languageCode: z
							.string()
							.optional()
							.describe("言語コード（例: 'ja'）"),
						regionCode: z
							.string()
							.length(2)
							.optional()
							.describe("地域コード（例: 'JP'）"),
						locationBias: z
							.object({
								latitude: z.number(),
								longitude: z.number(),
								radiusMeters: z.number().optional().default(5000),
							})
							.optional()
							.describe("検索の中心位置（任意）"),
					}),
					execute: async (params) => {
						const request: {
							textQuery: string;
							languageCode?: string;
							regionCode?: string;
							locationBias?: {
								circle: {
									center: { latitude: number; longitude: number };
									radius: number;
								};
							};
						} = {
							textQuery: params.query,
							languageCode: params.languageCode,
							regionCode: params.regionCode,
						};

						if (params.locationBias) {
							request.locationBias = {
								circle: {
									center: {
										latitude: params.locationBias.latitude,
										longitude: params.locationBias.longitude,
									},
									radius: params.locationBias.radiusMeters ?? 5000,
								},
							};
						}

						const [response] = await placesClient.searchText(request, {
							otherArgs: {
								headers: {
									"X-Goog-FieldMask":
										"places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.primaryType",
								},
							},
						});

						const places = response.places ?? [];
						return {
							count: places.length,
							places: places.map((place) => ({
								id: place.id,
								name: place.displayName?.text ?? "",
								address: place.formattedAddress ?? "",
								location: place.location
									? {
											latitude: place.location.latitude,
											longitude: place.location.longitude,
										}
									: undefined,
								rating: place.rating,
								primaryType: place.primaryType,
							})),
						};
					},
				}),
				google_places_nearby_search: tool({
					description:
						"Google Places Nearby Searchで周辺施設を検索し、名称・住所・座標などを取得します。",
					inputSchema: z.object({
						includedTypes: z
							.array(z.string())
							.min(1)
							.describe("Place Types配列（例: ['supermarket']）"),
						location: z.object({
							latitude: z.number(),
							longitude: z.number(),
						}),
						radiusMeters: z.number().min(1).max(50000).default(1000),
						maxResultCount: z.number().int().min(1).max(20).default(5),
						languageCode: z
							.string()
							.optional()
							.describe("言語コード（例: 'ja'）"),
					}),
					execute: async (params) => {
						const request = {
							includedTypes: params.includedTypes,
							maxResultCount: params.maxResultCount,
							locationRestriction: {
								circle: {
									center: {
										latitude: params.location.latitude,
										longitude: params.location.longitude,
									},
									radius: params.radiusMeters,
								},
							},
							languageCode: params.languageCode,
						};

						const [response] = await placesClient.searchNearby(request, {
							otherArgs: {
								headers: {
									"X-Goog-FieldMask":
										"places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.primaryType",
								},
							},
						});

						const places = response.places ?? [];
						return {
							count: places.length,
							places: places.map((place) => ({
								id: place.id,
								name: place.displayName?.text ?? "",
								address: place.formattedAddress ?? "",
								location: place.location
									? {
											latitude: place.location.latitude,
											longitude: place.location.longitude,
										}
									: undefined,
								rating: place.rating,
								primaryType: place.primaryType,
							})),
						};
					},
				}),
				google_routes_compute: tool({
					description:
						"Google Routes APIで移動時間・距離を計算します（例: 主要駅までの所要時間）。",
					inputSchema: z.object({
						origin: z.object({ latitude: z.number(), longitude: z.number() }),
						destination: z.object({
							latitude: z.number(),
							longitude: z.number(),
						}),
						travelMode: z
							.enum(["DRIVE", "WALK", "BICYCLE", "TRANSIT"])
							.default("DRIVE"),
						routingPreference: z
							.enum([
								"TRAFFIC_AWARE",
								"TRAFFIC_AWARE_OPTIMAL",
								"TRAFFIC_UNAWARE",
							])
							.default("TRAFFIC_AWARE"),
						languageCode: z
							.string()
							.optional()
							.describe("言語コード（例: 'ja-JP'）"),
						units: z.enum(["METRIC", "IMPERIAL"]).default("METRIC"),
					}),
					execute: async (params) => {
						const request = {
							origin: {
								location: {
									latLng: {
										latitude: params.origin.latitude,
										longitude: params.origin.longitude,
									},
								},
							},
							destination: {
								location: {
									latLng: {
										latitude: params.destination.latitude,
										longitude: params.destination.longitude,
									},
								},
							},
							travelMode: params.travelMode,
							routingPreference: params.routingPreference,
							computeAlternativeRoutes: false,
							languageCode: params.languageCode,
							units: params.units,
						};

						const [response] = await routesClient.computeRoutes(request, {
							otherArgs: {
								headers: {
									"X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
								},
							},
						});

						const routes = response.routes ?? [];
						return {
							count: routes.length,
							routes: routes.map((route) => ({
								distanceMeters: route.distanceMeters ?? 0,
								durationSeconds: route.duration?.seconds ?? 0,
							})),
						};
					},
				}),
				get_transaction_prices: tool({
					description:
						"指定された条件で不動産取引価格情報を取得します。地域の相場を把握し、価格分析スライドを作成するのに便利です。都道府県コード(area)は必須です。",
					inputSchema: z.object({
						year: z
							.number()
							.min(2005)
							.max(new Date().getFullYear())
							.describe("西暦年 (2005年以降)"),
						quarter: z
							.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
							.optional()
							.describe("四半期 (1:1-3月, 2:4-6月, 3:7-9月, 4:10-12月)"),
						area: z
							.string()
							.length(2)
							.describe("都道府県コード (例: 13 for 東京都)"),
						city: z
							.string()
							.min(5)
							.max(5)
							.optional()
							.describe("市区町村コード (例: 13101 for 千代田区)"),
						station: z.string().length(4).optional().describe("最寄駅コード"),
					}),
					execute: async (params) => {
						const res = await reinfoClient.getPriceInfo(params);
						return {
							count: res.data.length,
							samples: res.data.slice(0, 10),
							note: res.data.length > 10 ? "Showing top 10 results" : undefined,
						};
					},
				}),
				get_city_codes: tool({
					description:
						"都道府県コードから、その都道府県内の市区町村コード一覧を取得します。コードが不明な場合に使用します。",
					inputSchema: z.object({
						area: z.string().length(2).describe("都道府県コード (例: 13)"),
					}),
					execute: async (params) => {
						const res = await reinfoClient.getMunicipalities(params);
						return {
							count: res.data.length,
							samples: res.data.slice(0, 20),
							note:
								res.data.length > 20
									? "Showing top 20 results. Refine search if needed."
									: undefined,
						};
					},
				}),
				get_appraisal_reports: tool({
					description:
						"地価公示・都道府県地価調査情報を取得します。公的な土地価格の動向を調査するのに適しています。",
					inputSchema: z.object({
						year: z
							.number()
							.min(1970)
							.max(new Date().getFullYear())
							.describe("西暦年"),
						area: z.string().length(2).describe("都道府県コード"),
						division: z
							.enum([
								"00",
								"01",
								"02",
								"03",
								"04",
								"05",
								"06",
								"07",
								"08",
								"09",
								"10",
								"13",
							])
							.optional()
							.default("00")
							.describe(
								"用途区分 (00:全用途, 01:住宅地, 02:宅地見込地, 03:商業地, 04:準工業地, 05:工業地, etc.)",
							),
					}),
					execute: async (params) => {
						const query: AppraisalReportParams = params;
						const res = await reinfoClient.getAppraisalReports(query);
						return {
							count: res.data.length,
							samples: res.data.slice(0, 10),
							note: res.data.length > 10 ? "Showing top 10 results" : undefined,
						};
					},
				}),
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
			research: {
				summary: output.summary,
				keyFacts: output.keyFacts,
				sources: this.dedupeSources(output.sources),
			},
			usage: {
				promptTokens: usage.inputTokens ?? 0,
				completionTokens: usage.outputTokens ?? 0,
				totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
			},
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
	): {
		textStream: AsyncIterableStream<string>;
		getUsage: () => Promise<UsageInfo>;
	} {
		const messages: ModelMessage[] = [
			{
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
			},
		];

		if (!this.parallel) {
			this.messages.push(...messages);
		}

		const { response, textStream, usage } = streamText({
			model: this.model,
			tools: {
				evaluate_math_expression: tool({
					description:
						"数式（四則演算、関数など）を評価し、計算結果を数値で返します。",
					inputSchema: z.object({
						expression: z
							.string()
							.describe(
								"評価する数式。加算、減算、乗算、除算、括弧、指数などの基本的な算術演算をサポートします。",
							),
					}),
					execute: (params) => math.evaluate(params.expression),
				}),
				get_hazard_map_url: tool({
					description:
						"指定された住所に基づいて、国土交通省ハザードマップポータルのハザードマップ画像URLを取得します。",
					inputSchema: hazardMapOptionsSchema,
					execute: async (params) => {
						const buffer = await hazardMapGenerator.generate(params);
						const fileName = `hazard-maps/hazard-map-${Date.now()}.${params.format}`;
						await client.send(
							new PutObjectCommand({
								Bucket: "assets",
								Key: fileName,
								Body: buffer,
								ContentType: `image/${params.format}`,
								CacheControl: "public, max-age=31536000, immutable",
							}),
						);
						const publicUrl = `https://rdicyprpgreghjslbdts.supabase.co/storage/v1/object/public/assets/${fileName}`;
						return { url: publicUrl };
					},
				}),
				get_static_map_url: tool({
					description:
						"指定されたパラメータ（中心座標、ズーム、サイズ等）に基づいて、Google Maps Static APIの画像URLを取得します。",
					inputSchema: z.object({
						center: z
							.string()
							.describe(
								"地図の中心座標。カンマ区切りの緯度経度ペア（例: '40.714728,-73.998672'）または住所文字列（例: 'city hall, new york, ny'）。マーカーが存在しない場合は必須。",
							),
						zoom: z
							.number()
							.int()
							.min(0)
							.max(21)
							.describe(
								"地図のズームレベル（0-21）。マーカーが存在しない場合は必須。",
							),
						size: z
							.string()
							.regex(/^\d+x\d+$/)
							.describe(
								"地図画像のサイズ。'{幅}x{高さ}'形式（例: '500x400'）。必須。",
							),
						scale: z
							.number()
							.int()
							.min(1)
							.max(2)
							.optional()
							.default(1)
							.describe(
								"返されるピクセル数の倍率。1または2を指定可能。デフォルトは1。",
							),
						format: z
							.enum(["png", "png32", "gif", "jpg", "jpg-baseline"])
							.optional()
							.default("png")
							.describe("生成される画像の形式。デフォルトはpng。"),
						maptype: z
							.enum(["roadmap", "satellite", "hybrid", "terrain"])
							.optional()
							.default("roadmap")
							.describe("作成する地図のタイプ。デフォルトはroadmap。"),
						language: z
							.string()
							.optional()
							.describe(
								"地図タイル上のラベルの表示に使用する言語コード（例: 'ja', 'en'）。",
							),
						region: z
							.string()
							.length(2)
							.optional()
							.describe(
								"地政学的機密性に基づいて表示する境界を定義する2文字のccTLDコード（例: 'jp', 'us'）。",
							),
					}),
					execute: async (params) => {
						const key = process.env.GOOGLE_MAPS_API_KEY;
						const signature = "";
						const url = new URL(
							"https://maps.googleapis.com/maps/api/staticmap",
						);
						url.searchParams.append("center", params.center);
						url.searchParams.append("zoom", params.zoom.toString());
						url.searchParams.append("size", params.size);
						url.searchParams.append("scale", params.scale.toString());
						url.searchParams.append("format", params.format);
						url.searchParams.append("maptype", params.maptype);
						if (params.language) {
							url.searchParams.append("language", params.language);
						}
						if (params.region) {
							url.searchParams.append("region", params.region);
						}
						if (key) {
							url.searchParams.append("key", key);
						}
						if (signature) {
							url.searchParams.append("signature", signature);
						}

						const buffer = await ky
							.get(url)
							.arrayBuffer()
							.then((arrayBuffer) => Buffer.from(arrayBuffer));
						const fileName = `static-maps/static-map-${Date.now()}.${params.format}`;
						await client.send(
							new PutObjectCommand({
								Bucket: "assets",
								Key: fileName,
								Body: buffer,
								ContentType: `image/${params.format}`,
								CacheControl: "public, max-age=31536000, immutable",
							}),
						);
						const publicUrl = `https://rdicyprpgreghjslbdts.supabase.co/storage/v1/object/public/assets/${fileName}`;

						return { url: publicUrl };
					},
				}),
			},
			stopWhen: stepCountIs(5),
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
			messages: this.parallel ? [...this.messages, ...messages] : this.messages,
		});

		if (!this.parallel) {
			response.then(({ messages }) => this.messages.push(...messages));
		}

		return {
			textStream,
			getUsage: async () => {
				const usageData = await usage;
				return {
					promptTokens: usageData.inputTokens ?? 0,
					completionTokens: usageData.outputTokens ?? 0,
					totalTokens:
						(usageData.inputTokens ?? 0) + (usageData.outputTokens ?? 0),
				};
			},
		};
	}

	/**
	 * ファイル配列をData URL配列に変換
	 * Node.js環境ではBufferを使用して効率的にエンコード
	 */
	private async filesToDataUrls(files: File[]): Promise<string[]> {
		return Promise.all(
			files.map(async (file) => {
				const arrayBuffer = await file.arrayBuffer();
				// Node.js環境ではBufferを使用（より効率的）
				const base64 = Buffer.from(arrayBuffer).toString("base64");
				const mimeType = file.type || "image/png";
				return `data:${mimeType};base64,${base64}`;
			}),
		);
	}

	/**
	 * マイソクスライド用のHTMLを生成
	 * 複数画像がある場合はグリッド表示
	 */
	private createMaisokuSlideHtml(
		imageDataUrls: string[],
		designSystem: DesignSystem,
	): string {
		const bgClass = designSystem.commonClasses.slideBackground;

		// 画像がない場合のフォールバック
		if (imageDataUrls.length === 0) {
			return `<div id="slide-container" class="w-[1920px] h-[1080px] overflow-hidden relative ${bgClass} flex items-center justify-center">
	<p class="text-2xl text-gray-400">マイソク画像がありません</p>
</div>`;
		}

		if (imageDataUrls.length === 1) {
			// 単一画像: センター配置、最大サイズで表示
			return `<div id="slide-container" class="w-[1920px] h-[1080px] overflow-hidden relative ${bgClass} flex items-center justify-center p-12">
	<img src="${imageDataUrls[0]}" alt="マイソク" class="max-w-full max-h-full object-contain drop-shadow-2xl" />
</div>`;
		}

		// 複数画像: グリッド表示
		const gridCols = imageDataUrls.length <= 2 ? "grid-cols-2" : "grid-cols-3";
		const images = imageDataUrls
			.map(
				(url, i) =>
					`<img src="${url}" alt="マイソク ${i + 1}" class="max-w-full max-h-full object-contain drop-shadow-lg" />`,
			)
			.join("\n\t\t");

		return `<div id="slide-container" class="w-[1920px] h-[1080px] overflow-hidden relative ${bgClass} p-12">
	<div class="w-full h-full grid ${gridCols} gap-8 place-items-center">
		${images}
	</div>
</div>`;
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

		// 資金計画シミュレーション用の入力（オプション）
		const hasFinancialInfo =
			input.annualIncome ||
			input.downPayment ||
			input.interestRate ||
			input.loanTermYears;
		if (hasFinancialInfo) {
			textParts.push(`\n# 資金計画シミュレーション用情報`);
			if (input.annualIncome) {
				textParts.push(`- 年収: ${input.annualIncome}万円`);
			}
			if (input.downPayment) {
				textParts.push(`- 自己資金: ${input.downPayment}万円`);
			}
			if (input.interestRate) {
				textParts.push(`- 想定金利: ${input.interestRate}%`);
			}
			if (input.loanTermYears) {
				textParts.push(`- 返済期間: ${input.loanTermYears}年`);
			}
		}

		userContent.push({
			type: "text",
			text: textParts.join("\n"),
		});

		return userContent;
	}
}
