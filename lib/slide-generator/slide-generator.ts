import { google } from "@ai-sdk/google";
import {
	generateText,
	type LanguageModelUsage,
	type ModelMessage,
	Output,
	type UserContent,
} from "ai";
import { AsyncQueue } from "./async-queue";
import { type FixedSlideDefinition, SLIDE_DEFINITIONS } from "./config";
import { FlyerDataModel, flyerDataSchema, type PrimaryInput } from "./schemas";
import {
	type SlideContentMap,
	slideContentSchemas,
} from "./schemas/slide-content";
import { renderSlideHtml, wrapInHtmlDocument } from "./templates";
import { isStaticSlideType, renderStaticSlideBody } from "./templates/slides";
import { getToolsForSlide } from "./tools";
import type { Event, Slide, SlideType } from "./types";

/**
 * Buffer や循環参照を安全に処理する JSON.stringify
 * スタックオーバーフローを防ぐ
 */
function safeStringify(obj: unknown, indent = 2): string {
	const seen = new WeakSet();
	return JSON.stringify(
		obj,
		(_key, value) => {
			// Buffer オブジェクトを文字列に変換
			if (Buffer.isBuffer(value)) {
				return `[Buffer: ${value.length} bytes]`;
			}
			// ArrayBuffer や TypedArray を処理
			if (value instanceof ArrayBuffer) {
				return `[ArrayBuffer: ${value.byteLength} bytes]`;
			}
			if (ArrayBuffer.isView(value)) {
				return `[TypedArray: ${value.byteLength} bytes]`;
			}
			// 循環参照を検出
			if (typeof value === "object" && value !== null) {
				if (seen.has(value)) {
					return "[Circular]";
				}
				seen.add(value);
			}
			return value;
		},
		indent,
	);
}

/**
 * ツール実行結果の型定義
 */
interface ToolExecutionResult {
	/** ツール名 → 実行結果のマッピング */
	results: Record<string, unknown>;
}

/**
 * スライドログデータの型定義
 */
interface SlideLogData {
	/** スライド定義 */
	definition: FixedSlideDefinition;
	/** 入力プロンプト（LLMに送信したメッセージ） */
	inputPrompt?: {
		system: string;
		messages: ModelMessage[];
	};
	/** ツール実行結果 */
	toolResults?: Record<string, unknown>;
	/** LLM出力（構造化データ） */
	output?: unknown;
	/** 生成されたHTML */
	html: string;
	/** エラー情報 */
	error?: {
		message: string;
		stack?: string;
	};
	/** 使用トークン */
	usage?: LanguageModelUsage;
	/** 静的テンプレートかどうか */
	isStatic: boolean;
}

// ========================================
// SlideGenerator Class
// ========================================

export type ModelType = "low" | "middle" | "high";

export interface SlideGeneratorOptions {
	modelType?: ModelType;
	useStructuredOutput?: boolean;
}

// デフォルトのオプション
const defaultOptions = {
	modelType: "middle",
	useStructuredOutput: true,
} satisfies SlideGeneratorOptions;

export class SlideGenerator {
	private model;
	private messages: ModelMessage[] = [];
	private useStructuredOutput: boolean;
	/** マイソクから抽出したデータ */
	private flyerData: FlyerDataModel | null = null;
	/** マイソク画像のData URL */
	private maisokuDataUrl: string | null = null;
	/** マイソクPDFファイル（PDF形式の場合のみ保存） */
	private flyerPdfFile: File | null = null;

	constructor(options: SlideGeneratorOptions = {}) {
		this.useStructuredOutput =
			options.useStructuredOutput ?? defaultOptions.useStructuredOutput;

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
	}

	/**
	 * マイソクPDFファイルを取得（PDF形式の場合のみ）
	 */
	public getFlyerPdfFile(): File | null {
		return this.flyerPdfFile;
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

			// PDF形式かどうかを判定して保存
			const isPdf = input.flyerFiles[0].type === "application/pdf";
			if (isPdf) {
				this.flyerPdfFile = input.flyerFiles[0];
				console.log("[SlideGenerator] PDF format detected, will merge at the end");
			}

			// マイソク画像をData URLに変換して保存（ツール呼び出し用）
			const maisokuDataUrls = await this.filesToDataUrls(input.flyerFiles);
			this.maisokuDataUrl = maisokuDataUrls[0];

			// マイソクからデータを抽出
			this.flyerData = await this.extractFlyerData(input.flyerFiles[0]);
			this.messages.push({
				role: "user",
				content: `以下は、提供されたマイソクから抽出されたデータです:\n${this.flyerData.toPrompt()}`,
			});

			// Step 1: 固定の12枚スライド構成を使用
			yield { type: "plan:start" };
			const plan = SLIDE_DEFINITIONS;
			yield { type: "plan:end", data: { plan } };
			// 固定構成のため、planのusageは0
			yield {
				type: "usage",
				data: {
					step: "plan",
				},
			};

			// デザインシステムは固定のため、AI生成をスキップ
			yield {
				type: "usage",
				data: {
					step: "design",
				},
			};

			// Step 2: 1ページずつ並列でスライド生成
			const generatedSlides: Slide[] = [];
			const channel = new AsyncQueue<Event>();

			const promises = Promise.all(
				plan.map(async (slideDef: FixedSlideDefinition) => {
					const slideType = slideDef.slideType as SlideType;

					channel.push({
						type: "slide:start",
						data: {
							index: slideDef.index,
							title: slideDef.title,
							html: "",
							sources: [],
						},
					});

					let slide: GeneratedSlide;

					// PDF形式の場合、マイソクスライド（0枚目）はプレースホルダーを生成
					if (isPdf && slideType === "flyer") {
						console.log(`[SLIDE ${slideDef.index}] Generating placeholder for flyer slide (PDF format)`);

						// プレースホルダースライド: PDFダウンロード時に結合される旨を表示
						const placeholderHtml = wrapInHtmlDocument(`
							<div id="slide-container" class="w-[1920px] h-[1080px] bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] flex items-center justify-center text-[#2D3748]" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">
								<div class="text-center max-w-3xl px-12">
									<div class="mb-8">
										<div class="inline-block p-6 bg-white rounded-full shadow-lg mb-6">
											<svg class="w-24 h-24 text-[#C5A059]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
											</svg>
										</div>
									</div>
									<h1 class="text-[64px] font-serif font-bold mb-6 text-[#1A202C]">マイソク</h1>
									<p class="text-[32px] leading-relaxed text-[#4A5568]">
										マイソクPDFは、PDFダウンロード時に自動的に結合されます
									</p>
								</div>
							</div>
						`);

						slide = {
							html: placeholderHtml,
							sources: [],
						};

						channel.push({
							type: "slide:generating",
							index: slideDef.index,
							title: slideDef.title,
							data: { ...slide },
						});

						// 静的スライドのログデータを作成
						const logData: SlideLogData = {
							definition: slideDef,
							html: placeholderHtml,
							isStatic: true,
						};
						this.logSlideIO(logData);
					} else if (isStaticSlideType(slideType)) {
						// 静的テンプレート（tax, purchase-flow, 画像形式のflyer）: AI生成をスキップ
						let bodyContent: string;

						if (slideType === "flyer") {
							// 画像形式のマイソクスライド: アップロード画像をそのまま表示（全画面）
							const imageDataUrls = await this.filesToDataUrls(input.flyerFiles);
							bodyContent = renderStaticSlideBody("flyer", {
								imageUrls: imageDataUrls,
							});
						} else {
							// tax, purchase-flow: 完全に静的なテンプレート
							bodyContent = renderStaticSlideBody(slideType);
						}

						// Tailwind CSS等を含む完全なHTMLドキュメントにラップ
						const html = wrapInHtmlDocument(bodyContent);

						slide = {
							index: slideDef.index,
							title: slideDef.title,
							html,
							sources: [],
						};

						// 静的スライドのログデータを作成
						const logData: SlideLogData = {
							definition: slideDef,
							html,
							isStatic: true,
						};
						this.logSlideIO(logData);
					} else {
						// 構造化出力モードまたは生HTMLモードを選択
						try {
							const {
								html,
								usage: slideUsage,
								logData,
							} = this.useStructuredOutput
								? await this.generateSlideStructured(slideDef, input)
								: await this.generateSlideRawHtml(slideDef, input);

							slide = {
								index: slideDef.index,
								title: slideDef.title,
								html,
								sources: [],
							};

							channel.push({
								type: "usage",
								data: {
									step: `slide-${slideDef.index}`,
									usage: slideUsage,
								},
							});

							// ログ出力
							this.logSlideIO(logData);
						} catch (error) {
							console.error(
								`[SLIDE ${slideDef.index}] Error in slide generation:`,
								error,
							);

							// エラー時は空のスライドを生成
							slide = {
								index: slideDef.index,
								title: slideDef.title,
								html: `<div id="slide-container" class="w-[1920px] h-[1080px] flex items-center justify-center bg-red-50">
									<p class="text-red-500 text-2xl">スライド生成エラー: ${error instanceof Error ? error.message : "Unknown error"}</p>
								</div>`,
								sources: [],
							};
						}
					}

					channel.push({
						type: "slide:generating",
						data: slide,
					});

					generatedSlides.push(slide);

					channel.push({
						type: "slide:end",
						data: {
							index: slideDef.index,
							title: slideDef.title,
							html: slide.html,
							sources: slide.sources,
						},
					});
				}),
			);
			promises.then(() => {
				channel.close();
			});
			promises.catch(() => {
				channel.close();
			});
			for await (const event of channel) {
				yield event;
			}
			await promises;

			// 全体の完了（各スライドは既にslide:endで送信済みなのでデータは含めない）
			yield {
				type: "end",
				data: {
					plan,
					slides: generatedSlides,
				},
			};
		} catch (error) {
			yield {
				type: "error",
				data: {
					message: error instanceof Error ? error.message : "Unknown error",
				},
			};
		}
	}

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
- 物件価格（例: 5,800万円）
- 専有面積（例: 72.5㎡）
- 築年または建築年（西暦4桁で抽出）

築年・建築年の抽出ルール:
- 「築年月: 1998年10月」→ 1998年
- 「建築年: 2015年」→ 2015年
- 「完成時期: 2020年5月」→ 2020年
- 「平成10年」→ 1998年（西暦に変換）
- 新築で建築年が未記載の場合は、完成予定年を使用
- どうしても見つからない場合のみ省略可能

注意:
- 価格、面積が記載されていない場合は省略可能
- 築年は必ず西暦4桁（例: 1998、2015）で抽出してください
- 築年数（例: 築25年）ではなく、建築された年（例: 1998年）を抽出してください
`,
			messages: [
				{
					role: "user",
					content: [
						{ type: "image", image: await flyerFile.arrayBuffer() },
						{
							type: "text",
							text: "上記の画像は不動産物件のチラシです。記載されている全ての情報（物件名、価格、所在地、面積、築年、間取り、特徴、設備、アクセス情報など）を詳細に抽出してください。特に価格、面積、築年を正確に抽出してください。",
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
	 * LLMをスキップしてツール結果を直接使用できるかを判定
	 */
	private canSkipLLM(slideType: SlideType): boolean {
		// Slide 1 (Cover), 5 (Nearby), 6 (Price Analysis) はLLMスキップ可能
		return (
			slideType === "cover" ||
			slideType === "nearby" ||
			slideType === "price-analysis"
		);
	}

	/**
	 * ツール結果とマイソクデータからスライドコンテンツを直接生成（LLMスキップ）
	 */
	private buildSlideContentWithoutLLM(
		slideType: SlideType,
		toolResults: ToolExecutionResult | null,
		input: PrimaryInput,
	): unknown {
		switch (slideType) {
			case "cover": {
				// Slide 1: flyerData + input + ツール結果のマージ
				const imageUrl = toolResults?.results?.extract_property_image as
					| { imageUrl?: string }
					| undefined;
				return {
					propertyName: this.flyerData?.name || "",
					address: this.flyerData?.address,
					companyName: input.companyName,
					storeName: input.storeName,
					storeAddress: input.storeAddress,
					storePhoneNumber: input.storePhoneNumber,
					storeEmailAddress: input.storeEmailAddress,
					imageUrl: imageUrl?.imageUrl,
				};
			}

			case "nearby": {
				// Slide 5: ツール結果をそのまま使用
				const nearbyData = toolResults?.results?.generate_nearby_map as
					| {
							facilityGroups?: unknown[];
							address?: string;
							mapImageUrl?: string;
					  }
					| undefined;

				if (!nearbyData) {
					throw new Error("Nearby map tool did not return expected data");
				}

				return {
					facilityGroups: nearbyData.facilityGroups || [],
					address: nearbyData.address || this.flyerData?.address || "",
					mapImageUrl: nearbyData.mapImageUrl,
				};
			}

			case "price-analysis": {
				// Slide 6: ツール結果をそのまま使用
				const priceData = toolResults?.results?.get_price_points as
					| {
							targetProperty?: unknown;
							similarProperties?: unknown[];
							estimatedPriceMin?: string;
							estimatedPriceMax?: string;
							averageUnitPrice?: number;
							dataCount?: number;
					  }
					| undefined;

				if (!priceData) {
					throw new Error("Price analysis tool did not return expected data");
				}

				return {
					targetProperty: priceData.targetProperty,
					similarProperties: priceData.similarProperties || [],
					estimatedPriceMin: priceData.estimatedPriceMin || "-",
					estimatedPriceMax: priceData.estimatedPriceMax || "-",
					averageUnitPrice: priceData.averageUnitPrice,
					dataCount: priceData.dataCount,
				};
			}

			default:
				throw new Error(
					`Cannot build content without LLM for slide type: ${slideType}`,
				);
		}
	}

	/**
	 * Step 2: スライド生成（構造化出力版）
	 * Zodスキーマに基づく構造化データを生成し、固定テンプレートでHTMLにレンダリング
	 */
	private async generateSlideStructured(
		definition: FixedSlideDefinition,
		input: PrimaryInput,
	): Promise<{
		html: string;
		usage?: LanguageModelUsage;
		logData: SlideLogData;
	}> {
		const slideType = definition.slideType;
		const schema = slideContentSchemas[slideType];

		// スキーマが存在しないスライドタイプの場合はエラー
		if (!schema) {
			console.error(
				`[SLIDE ${definition.index}] Unknown slide type: ${slideType}`,
			);
			throw new Error(`Unknown slide type: ${slideType}`);
		}

		console.log(
			`[SLIDE ${definition.index}] Starting structured generation for slideType: ${slideType}`,
		);

		// Phase 1: ツールが必要なスライドは先にツールを実行
		let toolResults: ToolExecutionResult | null = null;
		const tools = getToolsForSlide(definition.index);
		const hasTools = Object.keys(tools).length > 0;

		if (hasTools) {
			console.log(
				`[SLIDE ${definition.index}] Executing tools: ${Object.keys(tools).join(", ")}`,
			);
			toolResults = await this.executeToolsForSlide(definition.index, tools);
			console.log(
				`[SLIDE ${definition.index}] Tool results:`,
				safeStringify(toolResults.results),
			);
		}

		// Phase 2: LLMスキップ可能かチェック
		let output: SlideContentMap[typeof slideType];
		let usage: LanguageModelUsage | undefined;

		if (this.canSkipLLM(slideType)) {
			console.log(
				`[SLIDE ${definition.index}] Skipping LLM - building content directly from tool results`,
			);

			// ツール結果から直接コンテンツを生成
			const rawOutput = this.buildSlideContentWithoutLLM(
				slideType,
				toolResults,
				input,
			);

			// Zodでバリデーション
			// biome-ignore lint/suspicious/noExplicitAny: 動的スキーマ選択
			output = schema.parse(rawOutput) as any;

			console.log(
				`[SLIDE ${definition.index}] Content built without LLM:`,
				safeStringify(output).substring(0, 500),
			);
		} else {
			// Phase 2: 構造化コンテンツを生成（従来のLLM経由）
			// ツール結果をプロンプトに含める
			const toolResultsPrompt = toolResults
				? `
# ツール実行結果
以下のツールを実行して取得したデータを使用してください。
imageUrl, facilityGroups等、スキーマと一致するフィールドは**そのままコピー**してください。

${safeStringify(toolResults.results)}
`
				: "";

			const systemPrompt = `あなたは不動産スライドのコンテンツ生成AIです。
指定されたスライドタイプ（${slideType}）に適した構造化データを生成してください。

# 重要な制約
- 全てのフィールドはスキーマで指定された文字数制限を厳守
- リスト項目は最大数を超えない
- 配列内の要素は重複不可（例: facilityGroupsで同じカテゴリーを2回含めない）
- 文字数が長すぎる場合は要約して収める
- これまでの会話で得られた情報を最大限活用する
- ツール実行結果にimageUrl, facilityGroups等、スキーマと一致するフィールドがある場合は、**そのまま対応するフィールドにコピー**すること

# 景品表示法（景表法）遵守 - 必須
以下の表現は景表法違反となるため、絶対に使用しないこと：
- 断定表現：「絶対」「必ず」「間違いなく」「完全」「完璧」「万全」等
- 裏付けのない最上級表現：「日本一」「業界初」「世界一」「地域No.1」「地域最大級」等（エビデンスがない場合）
- 確約できない表現：「特選」「厳選」「最高」「最高値」等
- 期日・期間をコミットする表現：「即座に」「即売れ」等
- 他社への誹謗中傷：「他社より優れた」等
- おとり系の表現：「購入希望者がいます」等（具体的な事実がない場合）
- 特別感を過度に示す表現：「今だけ」「期間限定」等

代わりに、事実に基づいた客観的な表現を使用すること。
例：「最高の立地」→「駅徒歩3分の好立地」、「完璧な間取り」→「3LDK・全室南向き」

# 出力形式
構造化データのみを出力。余計な説明は不要。`;

			const messages: ModelMessage[] = [
				{
					role: "user",
					content: `
# スライド定義
- タイトル: ${definition.title}
- 概要: ${definition.description}
- スライドタイプ: ${slideType}
- コンテンツヒント: ${definition.contentHints.join(", ")}

# 店舗情報
- 会社名: ${input.companyName}
${input.storeName ? `- 店舗名: ${input.storeName}` : ""}
${input.storeAddress ? `- 住所: ${input.storeAddress}` : ""}
${input.storePhoneNumber ? `- 電話番号: ${input.storePhoneNumber}` : ""}
${input.storeEmailAddress ? `- メールアドレス: ${input.storeEmailAddress}` : ""}
${toolResultsPrompt}
上記の情報に基づき、スライドのコンテンツを構造化データとして出力してください。
スキーマの制約（文字数・項目数）を厳守してください。
`,
				},
			];

			const result = await generateText({
				model: this.model,
				system: systemPrompt,
				messages: [...this.messages, ...messages],
				// biome-ignore lint/suspicious/noExplicitAny: 動的スキーマ選択
				output: Output.object({ name: "slide_content", schema: schema as any }),
			});

			output = result.output as SlideContentMap[typeof slideType];

			// ツール使用量を加算
			usage = result.usage;

			console.log(
				`[SLIDE ${definition.index}] Structured output received:`,
				safeStringify(output).substring(0, 500),
			);
		}

		// Phase 3: HTML生成
		try {
			const html = renderSlideHtml(
				slideType,
				output as SlideContentMap[typeof slideType],
			);

			console.log(`[SLIDE ${definition.index}] HTML generated successfully`);

			// ログデータを構築
			const logData: SlideLogData = {
				definition,
				toolResults: toolResults?.results,
				output,
				html,
				usage,
				isStatic: false,
			};

			return { html, usage, logData };
		} catch (error) {
			console.error(
				`[SLIDE ${definition.index}] Error in generateSlideStructured:`,
				error,
			);

			// エラー時もログデータを構築
			const errorLogData: SlideLogData = {
				definition,
				toolResults: toolResults?.results,
				html: "",
				error: {
					message: error instanceof Error ? error.message : "Unknown error",
					stack: error instanceof Error ? error.stack : undefined,
				},
				isStatic: false,
			};

			// エラーログを保存
			this.logSlideIO(errorLogData);

			throw error;
		}
	}

	/**
	 * スライド用のツールを実行
	 * 各スライドタイプに応じた適切なパラメータでツールを呼び出す
	 */
	private async executeToolsForSlide(
		slideIndex: number,
		tools: Record<string, unknown>,
	): Promise<ToolExecutionResult> {
		const results: Record<string, unknown> = {};
		// スライドごとに適切なツール呼び出しを行う
		for (const [toolName, toolInstance] of Object.entries(tools)) {
			try {
				console.log(`[SLIDE ${slideIndex}] Calling tool: ${toolName}`);

				// ツールのexecute関数を直接呼び出す
				// biome-ignore lint/suspicious/noExplicitAny: 動的ツール呼び出し
				const tool = toolInstance as any;

				let result: unknown;

				// ツール名に基づいてパラメータを決定
				switch (toolName) {
					case "extract_property_image":
					case "extract_floorplan_image":
						// 画像抽出ツール: マイソク画像URLが必要
						if (!this.maisokuDataUrl) {
							throw new Error("マイソク画像URLが設定されていません");
						}
						result = await tool.execute({
							maisokuImageUrl: this.maisokuDataUrl,
						});
						break;

					case "search_nearby_facilities":
					case "generate_nearby_map":
						// 住所ベースのツール（addressパラメータ）
						if (!this.flyerData?.address) {
							throw new Error("物件住所が設定されていません");
						}
						result = await tool.execute({
							address: this.flyerData.address,
						});
						break;

					case "get_price_points":
						// 価格分析ツール（addressパラメータ + targetPropertyInput）
						if (!this.flyerData?.address) {
							throw new Error("物件住所が設定されていません");
						}
						result = await tool.execute({
							address: this.flyerData.address,
							zoom: 13, // 検索範囲を広げる（14→13で範囲が2倍に）
							yearsBack: 5,
							maxResults: 6,
							targetPropertyInput: {
								name: this.flyerData.name,
								price: this.flyerData.price,
								area: this.flyerData.area,
								constructionYear: this.flyerData.constructionYear,
							},
						});
						break;

					case "get_hazard_map_url":
					case "generate_shelter_map":
						// 座標/住所ベースのツール（centerパラメータ）
						if (!this.flyerData?.address) {
							throw new Error("物件住所が設定されていません");
						}
						result = await tool.execute({
							center: this.flyerData.address,
						});
						break;

					case "get_price_info":
					case "get_municipalities":
						// これらのツールは現状では直接呼び出さない（get_price_pointsで代替）
						console.log(
							`[SLIDE ${slideIndex}] Skipping tool ${toolName} (using get_price_points instead)`,
						);
						continue;

					default:
						console.warn(
							`[SLIDE ${slideIndex}] Unknown tool: ${toolName}, skipping`,
						);
						continue;
				}

				results[toolName] = result;
				console.log(
					`[SLIDE ${slideIndex}] Tool ${toolName} completed:`,
					safeStringify(result).substring(0, 300),
				);
			} catch (error) {
				console.error(`[SLIDE ${slideIndex}] Tool ${toolName} failed:`, error);
				// エラーでも続行（他のツールは実行する）
				results[toolName] = {
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}

		return { results };
	}

	/**
	 * Step 2b: スライド生成（生HTML版）
	 * LLMが直接HTMLを生成する（テンプレートなし）
	 */
	private async generateSlideRawHtml(
		definition: FixedSlideDefinition,
		input: PrimaryInput,
	): Promise<{
		html: string;
		usage: LanguageModelUsage;
		logData: SlideLogData;
	}> {
		console.log(
			`[SLIDE ${definition.index}] Starting raw HTML generation for slideType: ${definition.slideType}`,
		);

		const systemPrompt = `あなたは不動産プレゼンテーションスライドのHTML生成AIです。
以下のデザインシステムに従って、美しく洗練されたスライドHTMLを生成してください。

# デザインシステム
## カラーパレット
- primary: #1A202C (濃いグレー - タイトル、重要テキスト)
- secondary: #C5A059 (ゴールド - アクセント、ボーダー)
- accent: #E2E8F0 (薄いグレー - 背景アクセント)
- background: #FDFCFB (オフホワイト - 背景)
- surface: #FFFFFF (白 - カード背景)
- text: #2D3748 (ダークグレー - 本文)

## タイポグラフィ
- フォント: 'Noto Serif JP', 'Playfair Display', serif

# 景品表示法（景表法）遵守 - 必須
以下の表現は景表法違反となるため、絶対に使用しないこと：
- 断定表現：「絶対」「必ず」「間違いなく」「完全」「完璧」「万全」等
- 裏付けのない最上級表現：「日本一」「業界初」「世界一」「地域No.1」「地域最大級」等（エビデンスがない場合）
- 確約できない表現：「特選」「厳選」「最高」「最高値」等
- 期日・期間をコミットする表現：「即座に」「即売れ」等
- 他社への誹謗中傷：「他社より優れた」等
- おとり系の表現：「購入希望者がいます」等（具体的な事実がない場合）
- 特別感を過度に示す表現：「今だけ」「期間限定」等

代わりに、事実に基づいた客観的な表現を使用すること。
例：「最高の立地」→「駅徒歩3分の好立地」、「完璧な間取り」→「3LDK・全室南向き」

# 出力ルール
1. 必ず <div id="slide-container" class="w-[1920px] h-[1080px] ..."> で開始
2. Tailwind CSS v4のクラスを使用
3. HTMLのみを出力（\`\`\`htmlなどのマークダウン記法は不要）
4. 高級不動産にふさわしい上品で洗練されたデザイン
5. 情報は読みやすく整理し、余白を効果的に使用
6. テキストが溢れないよう、適切なサイズとline-clampを使用

# スタイル例
- タイトル: text-[84px] font-serif font-bold text-[#1A202C] border-l-[12px] border-[#C5A059] pl-10
- サブタイトル: text-[56px] font-serif font-medium text-[#1A202C]
- 本文: text-[26px] font-sans leading-[1.8] text-[#4A5568]
- カード: bg-white border border-[#E2E8F0] shadow-[0_20px_50px_rgba(0,0,0,0.05)]`;

		const messages: ModelMessage[] = [
			{
				role: "user",
				content: `
# スライド定義
- タイトル: ${definition.title}
- 概要: ${definition.description}
- スライドタイプ: ${definition.slideType}
- コンテンツヒント: ${definition.contentHints.join(", ")}

# 店舗情報
- 会社名: ${input.companyName}
${input.storeName ? `- 店舗名: ${input.storeName}` : ""}
${input.storeAddress ? `- 住所: ${input.storeAddress}` : ""}
${input.storePhoneNumber ? `- 電話番号: ${input.storePhoneNumber}` : ""}
${input.storeEmailAddress ? `- メールアドレス: ${input.storeEmailAddress}` : ""}

上記の情報に基づき、スライドのHTMLを生成してください。
`,
			},
		];

		const { text, usage } = await generateText({
			model: this.model,
			system: systemPrompt,
			messages: [...this.messages, ...messages],
		});

		// HTMLを抽出（マークダウンのコードブロックが含まれている場合に対応）
		let html = text.trim();
		const codeBlockMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/);
		if (codeBlockMatch) {
			html = codeBlockMatch[1].trim();
		}

		console.log(`[SLIDE ${definition.index}] Raw HTML generated successfully`);

		const logData: SlideLogData = {
			definition,
			inputPrompt: {
				system: systemPrompt,
				messages: [...this.messages, ...messages],
			},
			output: text,
			html,
			usage,
			isStatic: false,
		};

		return { html, usage, logData };
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

		textParts.push(`# 店舗情報`);
		textParts.push(`- 会社名: ${input.companyName}`);
		if (input.storeName) {
			textParts.push(`- 店舗名: ${input.storeName}`);
		}
		if (input.storeAddress) {
			textParts.push(`- 住所: ${input.storeAddress}`);
		}
		if (input.storePhoneNumber) {
			textParts.push(`- 電話番号: ${input.storePhoneNumber}`);
		}
		if (input.storeEmailAddress) {
			textParts.push(`- メールアドレス: ${input.storeEmailAddress}`);
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

	/**
	 * スライドのインプット・アウトプットをログ出力
	 */
	private logSlideIO(logData: SlideLogData): void {
		const slideDef = logData.definition;

		// コンソール出力
		console.log(`\n${"=".repeat(80)}`);
		console.log(
			`📄 SLIDE ${slideDef.index}: ${slideDef.title}${logData.isStatic ? " (STATIC)" : ""}`,
		);
		console.log("=".repeat(80));

		if (logData.error) {
			console.log("\n--- ERROR ---");
			console.log(logData.error.message);
		}

		console.log(`${"=".repeat(80)}\n`);

		// ファイル出力は一時的に無効化
		// const now = new Date();
		// const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
		// const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "");
		// const timestamp = `${dateStr}_${timeStr}`;
		// const logDir = path.join(process.cwd(), "logs", "slides");

		// if (!fs.existsSync(logDir)) {
		// 	fs.mkdirSync(logDir, { recursive: true });
		// }

		// const logFileName = `${timestamp}_slide${slideDef.index}.txt`;
		// const logFilePath = path.join(logDir, logFileName);
		// const sections: string[] = [];
		// sections.push(`...`);
		// fs.writeFileSync(logFilePath, sections.join("\n"), "utf-8");
		// console.log(`📁 Log saved: ${logFilePath}`);

		// const htmlFileName = `${timestamp}_slide${slideDef.index}.html`;
		// const htmlFilePath = path.join(logDir, htmlFileName);
		// fs.writeFileSync(htmlFilePath, logData.html, "utf-8");
		// console.log(`📁 HTML saved: ${htmlFilePath}`);
	}
}
