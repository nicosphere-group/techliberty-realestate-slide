// import * as fs from "node:fs";
// import * as path from "node:path";
import { google } from "@ai-sdk/google";
import {
	generateText,
	type ModelMessage,
	Output,
	type UserContent,
} from "ai";
import { AsyncQueue } from "./async-queue";
import { SLIDE_DEFINITIONS, type FixedSlideDefinition } from "./config";
import {
	FlyerDataModel,
	flyerDataSchema,
	type PrimaryInput,
} from "./schemas";
import {
	slideContentSchemas,
	type SlideContentMap,
} from "./schemas/slide-content";
import { renderSlideHtml, wrapInHtmlDocument } from "./templates";
import {
	isStaticSlideType,
	renderStaticSlideBody,
} from "./templates/slides";
import { getToolsForSlide } from "./tools";
import type { SlideType } from "./types/slide-types";
import type { Event, GeneratedSlide, UsageInfo } from "./types";

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
	/** ツール実行で使用したトークン */
	usage: UsageInfo;
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
	usage?: UsageInfo;
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
			yield { type: "plan:end", plan };
			// 固定構成のため、planのusageは0
			yield {
				type: "usage",
				usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
				step: "plan",
			};

			// デザインシステムは固定のため、AI生成をスキップ
			yield {
				type: "usage",
				usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
				step: "design",
			};

			// Step 2: 1ページずつ並列でスライド生成
			const generatedSlides: GeneratedSlide[] = [];
			const channel = new AsyncQueue<Event>();

			// Heartbeatタイマー: 30秒ごとに送信してストリーム接続を維持
			const heartbeatInterval = setInterval(() => {
				channel.push({
					type: "heartbeat",
					timestamp: Date.now(),
				});
			}, 30000);

			const promises = Promise.all(
				plan.map(async (slideDef: FixedSlideDefinition) => {
					channel.push({
						type: "slide:start",
						index: slideDef.index,
						title: slideDef.title,
					});

					let slide: GeneratedSlide;
					const slideType = slideDef.slideType as SlideType;

					// 静的テンプレート（tax, purchase-flow, flyer）: AI生成をスキップ
					if (isStaticSlideType(slideType)) {
						let bodyContent: string;

						if (slideType === "flyer") {
							// マイソクスライド: アップロード画像をそのまま表示
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
							html,
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
							slide = { html, sources: [] };

							channel.push({
								type: "slide:generating",
								index: slideDef.index,
								title: slideDef.title,
								data: { ...slide },
							});

							channel.push({
								type: "usage",
								usage: slideUsage,
								step: `slide-${slideDef.index}`,
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
								html: `<div id="slide-container" class="w-[1920px] h-[1080px] flex items-center justify-center bg-red-50">
									<p class="text-red-500 text-2xl">スライド生成エラー: ${error instanceof Error ? error.message : "Unknown error"}</p>
								</div>`,
								sources: [],
							};
							channel.push({
								type: "slide:generating",
								index: slideDef.index,
								title: slideDef.title,
								data: { ...slide },
							});
						}
					}

					generatedSlides.push(slide);

					channel.push({
						type: "slide:end",
						index: slideDef.index,
						title: slideDef.title,
						data: {
							slide: { ...slide },
						},
					});
				}),
			);
			promises.then(() => {
				clearInterval(heartbeatInterval);
				channel.close();
			});
			promises.catch(() => {
				clearInterval(heartbeatInterval);
				channel.close();
			});
			for await (const event of channel) {
				yield event;
			}
			await promises;

			// 全体の完了（各スライドは既にslide:endで送信済みなのでデータは含めない）
			yield { type: "end", data: [] };
		} catch (error) {
			yield {
				type: "error",
				message: error instanceof Error ? error.message : "Unknown error",
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
	 * Step 2: スライド生成（構造化出力版）
	 * Zodスキーマに基づく構造化データを生成し、固定テンプレートでHTMLにレンダリング
	 */
	private async generateSlideStructured(
		definition: FixedSlideDefinition,
		input: PrimaryInput,
	): Promise<{ html: string; usage: UsageInfo; logData: SlideLogData }> {
		const slideType = definition.slideType as SlideType;
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

		// Phase 2: 構造化コンテンツを生成
		// ツール結果をプロンプトに含める
		const toolResultsPrompt = toolResults
			? `
# ツール実行結果
以下のツールを実行して取得したデータを使用してください。
imageUrl等はそのまま使用してください。

${safeStringify(toolResults.results)}
`
			: "";

		const systemPrompt = `あなたは不動産スライドのコンテンツ生成AIです。
指定されたスライドタイプ（${slideType}）に適した構造化データを生成してください。

# 重要な制約
- 全てのフィールドはスキーマで指定された文字数制限を厳守
- リスト項目は最大数を超えない
- 文字数が長すぎる場合は要約して収める
- これまでの会話で得られた情報を最大限活用する
- ツール実行結果にimageUrl, imageAspectRatio等がある場合は、そのまま対応するフィールドにコピーすること

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

# 顧客情報
- 顧客名: ${input.customerName}
- 担当者名: ${input.agentName}
${input.agentPhoneNumber ? `- 電話番号: ${input.agentPhoneNumber}` : ""}
${input.agentEmailAddress ? `- メールアドレス: ${input.agentEmailAddress}` : ""}
${toolResultsPrompt}
上記の情報に基づき、スライドのコンテンツを構造化データとして出力してください。
スキーマの制約（文字数・項目数）を厳守してください。
`,
			},
		];

		try {
			const { output, usage } = await generateText({
				model: this.model,
				system: systemPrompt,
				messages: [...this.messages, ...messages],
				// biome-ignore lint/suspicious/noExplicitAny: 動的スキーマ選択
				output: Output.object({ name: "slide_content", schema: schema as any }),
			});

			console.log(
				`[SLIDE ${definition.index}] Structured output received:`,
				safeStringify(output).substring(0, 500),
			);

			// 固定テンプレートでHTML生成
			const html = renderSlideHtml(
				slideType,
				output as SlideContentMap[typeof slideType],
			);

			console.log(`[SLIDE ${definition.index}] HTML generated successfully`);

			// ツール使用量を加算
			const totalUsage: UsageInfo = {
				promptTokens:
					(usage.inputTokens ?? 0) + (toolResults?.usage.promptTokens ?? 0),
				completionTokens:
					(usage.outputTokens ?? 0) + (toolResults?.usage.completionTokens ?? 0),
				totalTokens:
					(usage.inputTokens ?? 0) +
					(usage.outputTokens ?? 0) +
					(toolResults?.usage.totalTokens ?? 0),
			};

			// ログデータを構築
			const logData: SlideLogData = {
				definition,
				inputPrompt: {
					system: systemPrompt,
					messages: [...this.messages, ...messages],
				},
				toolResults: toolResults?.results,
				output,
				html,
				usage: totalUsage,
				isStatic: false,
			};

			return { html, usage: totalUsage, logData };
		} catch (error) {
			console.error(
				`[SLIDE ${definition.index}] Error in generateSlideStructured:`,
				error,
			);

			// エラー時もログデータを構築
			const errorLogData: SlideLogData = {
				definition,
				inputPrompt: {
					system: systemPrompt,
					messages: [...this.messages, ...messages],
				},
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
		let totalUsage: UsageInfo = {
			promptTokens: 0,
			completionTokens: 0,
			totalTokens: 0,
		};

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
				case "get_price_points":
					// 住所ベースのツール（addressパラメータ）
					if (!this.flyerData?.address) {
						throw new Error("物件住所が設定されていません");
					}
					result = await tool.execute({
						address: this.flyerData.address,
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
				console.error(
					`[SLIDE ${slideIndex}] Tool ${toolName} failed:`,
					error,
				);
				// エラーでも続行（他のツールは実行する）
				results[toolName] = {
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}

		return { results, usage: totalUsage };
	}

	/**
	 * Step 2b: スライド生成（生HTML版）
	 * LLMが直接HTMLを生成する（テンプレートなし）
	 */
	private async generateSlideRawHtml(
		definition: FixedSlideDefinition,
		input: PrimaryInput,
	): Promise<{ html: string; usage: UsageInfo; logData: SlideLogData }> {
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

# 顧客情報
- 顧客名: ${input.customerName}
- 担当者名: ${input.agentName}
${input.agentPhoneNumber ? `- 電話番号: ${input.agentPhoneNumber}` : ""}
${input.agentEmailAddress ? `- メールアドレス: ${input.agentEmailAddress}` : ""}

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

		const totalUsage: UsageInfo = {
			promptTokens: usage.inputTokens ?? 0,
			completionTokens: usage.outputTokens ?? 0,
			totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
		};

		const logData: SlideLogData = {
			definition,
			inputPrompt: {
				system: systemPrompt,
				messages: [...this.messages, ...messages],
			},
			output: text,
			html,
			usage: totalUsage,
			isStatic: false,
		};

		return { html, usage: totalUsage, logData };
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

	/**
	 * スライドのインプット・アウトプットをログ出力
	 */
	private logSlideIO(logData: SlideLogData): void {
		const slideDef = logData.definition;

		// コンソール出力
		console.log("\n" + "=".repeat(80));
		console.log(
			`📄 SLIDE ${slideDef.index}: ${slideDef.title}${logData.isStatic ? " (STATIC)" : ""}`,
		);
		console.log("=".repeat(80));

		if (logData.error) {
			console.log("\n--- ERROR ---");
			console.log(logData.error.message);
		}

		console.log("=".repeat(80) + "\n");

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
