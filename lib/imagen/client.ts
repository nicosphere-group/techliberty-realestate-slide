/**
 * 不動産スライド用画像生成クライアント
 * Gemini 画像生成API (gemini-3-pro-image-preview) を使用
 */

import {
	type Content,
	GoogleGenAI,
	HarmBlockThreshold,
	HarmCategory,
	type Part,
} from "@google/genai";
import { PlacesClient } from "@googlemaps/places";
import { RoutesClient } from "@googlemaps/routing";
import ky from "ky";
import sharp from "sharp";
import { ObjectDetection } from "../object-detection/client";
import { boundingBoxSchema } from "./schemas";
import type {
	BoundingBox,
	ExtractFloorPlanParams,
	ExtractPropertyImageParams,
	GeneratedImage,
	GenerateRouteMapFromAddressParams,
	GenerateRouteMapParams,
	ImageGenerationResult,
	MajorStation,
	NearestStationInfo,
	RouteDataResult,
	RouteInfo,
} from "./types";
import { blobToBase64, cropBoundingBoxes, fetchAsBlob } from "./utils";

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/** 東京近郊のデフォルト主要駅 */
const DEFAULT_MAJOR_STATIONS: MajorStation[] = [
	{ name: "東京", latitude: 35.6812, longitude: 139.7671 },
	{ name: "渋谷", latitude: 35.658, longitude: 139.7016 },
	{ name: "新宿", latitude: 35.6896, longitude: 139.7006 },
	{ name: "池袋", latitude: 35.7295, longitude: 139.7109 },
	{ name: "品川", latitude: 35.6284, longitude: 139.7387 },
	{ name: "横浜", latitude: 35.4657, longitude: 139.6224 },
];

/** 画像サイズ: 2K固定 */
const IMAGE_SIZE = "2K" as const;

/**
 * エラーメッセージを日本語に変換
 */
function extractErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		const message = error.message;
		if (message.includes("SAFETY")) {
			return "安全性ポリシーにより画像を生成できませんでした。";
		}
		if (message.includes("RECITATION")) {
			return "著作権の問題により画像を生成できませんでした。";
		}
		if (message.includes("BLOCKED")) {
			return "コンテンツがブロックされました。";
		}
		if (message.includes("quota") || message.includes("QUOTA")) {
			return "APIの利用制限に達しました。";
		}
		if (message.includes("rate") || message.includes("RATE")) {
			return "リクエストが多すぎます。";
		}
		return message;
	}
	return "画像生成に失敗しました。";
}

/**
 * 不動産スライド用画像生成クライアント
 */
export class RealEstateImagen {
	private ai: GoogleGenAI;
	private placesClient: PlacesClient | null = null;
	private routesClient: RoutesClient | null = null;
	private objectDetection = new ObjectDetection();

	constructor(apiKey?: string, mapsApiKey?: string) {
		const key = apiKey || GEMINI_API_KEY;
		if (!key) {
			throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
		}
		this.ai = new GoogleGenAI({ apiKey: key });

		// Google Maps APIクライアントの初期化（オプション）
		const mapsKey = mapsApiKey || GOOGLE_MAPS_API_KEY;
		if (mapsKey) {
			this.placesClient = new PlacesClient({ apiKey: mapsKey });
			this.routesClient = new RoutesClient({ apiKey: mapsKey });
		}
	}

	/**
	 * マイソク画像から物件写真を抽出
	 * 2段階処理: 1) Vision APIで領域検出 → 2) Sharpでクロップ → 3) 綺麗に再生成
	 */
	async extractPropertyImage(
		params: ExtractPropertyImageParams,
	): Promise<ImageGenerationResult> {
		const aspectRatio = "3:4";

		try {
			// マイソク画像を取得
			const maisokuBlob = await fetchAsBlob(params.maisokuImageUrl);

			// Step 1: Vision APIで外観写真の領域を検出
			// console.log("Step 1: 外観写真の領域を検出中...")
			const boundingBoxes =
				await this.detectPropertyImageBoundingBoxes(maisokuBlob);
			if (boundingBoxes.length === 0) {
				return {
					image: null,
					error: "外観写真を検出できませんでした。",
				};
			}
			// console.log("検出されたバウンディングボックス:", boundingBoxes)

			// Step 2: Sharpでクロップ
			// console.log("Step 2: 外観写真をクロップ中...")
			const bestBoundingBox = boundingBoxes.reduce((best, current) => {
				const bestArea =
					(best.box_2d[3] - best.box_2d[1]) * (best.box_2d[2] - best.box_2d[0]);
				const currentArea =
					(current.box_2d[3] - current.box_2d[1]) *
					(current.box_2d[2] - current.box_2d[0]);
				return currentArea > bestArea ? current : best;
			});

			const croppedBlobs = await cropBoundingBoxes(maisokuBlob, [
				bestBoundingBox,
			]);
			const croppedBlob = croppedBlobs[0];
			if (!croppedBlob) {
				return {
					image: null,
					error: "外観写真のクロップに失敗しました。",
				};
			}

			const croppedImage = croppedBlob;

			// クロップ画像を中間結果として保存
			const croppedImageData: GeneratedImage = {
				blob: croppedImage,
				prompt: "クロップ済み外観写真",
			};

			// Step 3: クロップした外観写真を綺麗に再生成
			// console.log("Step 3: 外観写真を綺麗に再生成中...")
			const result = await this.regeneratePropertyImage(
				croppedImage,
				aspectRatio,
			);

			// 中間画像を結果に追加
			return {
				...result,
				intermediateImage: croppedImageData,
			};
		} catch (error) {
			console.error("Failed to extract property image:", error);
			return {
				image: null,
				error: extractErrorMessage(error),
			};
		}
	}

	/**
	 * Vision APIで外観写真のバウンディングボックスを検出
	 * Gemini公式セグメンテーション形式を使用
	 * Reference: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/bounding-box-detection
	 */
	private async detectPropertyImageBoundingBoxes(
		imageBlob: Blob,
	): Promise<BoundingBox[]> {
		const prompt = `あなたは不動産チラシ（マイソク）の画像解析エキスパートです。
この画像から建物の外観写真を正確に検出してください。

【外観写真の特徴】
- 建物を外から撮影した写真（マンション、アパート、一戸建ての外観）
- 建物全体または大部分が写っている
- 通常は縦長（ポートレート）または正方形に近い形状
- 1枚の独立した写真として存在する
- 「外観」というラベルが付いていることが多い

【除外対象】
- 室内写真（リビング、キッチン、浴室など）
- 間取り図（フロアプラン）
- 地図・周辺案内図
- エントランス・廊下のみの写真
- 周辺施設の写真
- 小さなサムネイル写真

【選択基準】
1. 建物の外観全体が写っている写真を最優先
2. 複数の外観写真がある場合は、最も大きいサイズの写真を1つだけ選ぶ
3. メインの大きな写真を選び、横並びの小さな写真グループは避ける
4. 外観写真が見つからない場合は空の配列を返す

【座標の精度】
- 写真の枠線・境界を正確に検出する
- 隣接する他の写真、間取り図、テキストを含めない
- 写真1枚だけをぴったり囲むバウンディングボックスを返す

【出力形式】
Output a JSON list where each entry contains:
- "box_2d": [y0, x0, y1, x1] with normalized coordinates from 0 to 1000
- "label": descriptive label (e.g., "building_exterior", "マンション外観")

Return empty array [] if no exterior photo is found.`;

		const base64 = await blobToBase64(imageBlob);
		const parts: Part[] = [
			{
				inlineData: {
					data: base64,
					mimeType: imageBlob.type,
				},
			},
			{ text: prompt },
		];

		const contents: Content[] = [{ role: "user", parts }];

		const response = await this.ai.models.generateContent({
			model: "gemini-3-flash-preview",
			contents,
			config: {
				temperature: 0.5,
				safetySettings: [
					{
						category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
						threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
					},
				],
				responseMimeType: "application/json",
				responseJsonSchema: boundingBoxSchema.array().toJSONSchema(),
			},
		});

		const boundingBoxes = await boundingBoxSchema
			.array()
			.parseAsync(JSON.parse(response.text ?? ""));

		return boundingBoxes;
	}

	/**
	 * クロップした外観写真を綺麗に再生成
	 */
	private async regeneratePropertyImage(
		croppedImage: Blob,
		aspectRatio: string,
	): Promise<ImageGenerationResult> {
		const prompt = `この画像は不動産チラシ（マイソク）からクロップした建物の外観写真です。
クロップの際に周囲の情報（ラベル、他の写真、テキスト、ぼやけた部分など）が含まれている可能性があります。

【タスク】
建物の外観写真のみを抽出し、綺麗に再生成してください。

【重要な制約】
- 建物の外観写真だけを生成すること（他の写真、ラベル、テキスト、ぼやけた部分は絶対に含めない）
- 「外観」などのラベルや文字は含めないこと
- エントランス写真など、別の写真が含まれていても無視し、メインの建物外観のみを生成
- 建物の形状、階数、外観デザインは元の写真に忠実であること
- 下部や端にあるぼやけた部分やグレーの領域は除外すること

【スタイル】
- プロの不動産写真のような高品質な仕上がり
- 明るく清潔感のある雰囲気
- 晴れた日の自然光を活かした撮影風
- 人物は含めない
- 建物全体が収まるように構図を調整

【出力】
3:4の縦長画像で、建物の外観のみを出力してください。`;

		const base64 = await blobToBase64(croppedImage);
		const parts: Part[] = [
			{
				inlineData: {
					data: base64,
					mimeType: croppedImage.type || "image/png",
				},
			},
			{ text: prompt },
		];

		const contents: Content[] = [{ role: "user", parts }];

		const response = await this.ai.models.generateContent({
			model: "gemini-3-pro-image-preview",
			contents,
			config: {
				responseModalities: ["TEXT", "IMAGE"],
				imageConfig: {
					aspectRatio,
					imageSize: IMAGE_SIZE,
				},
			},
		});

		return this.extractImageFromResponse(response, prompt, aspectRatio);
	}

	/**
	 * マイソク画像から間取り図を抽出
	 * 2段階処理: 1) Vision APIで領域検出 → 2) Sharpでクロップ → 3) 綺麗に再生成
	 */
	async extractFloorPlanImage(
		params: ExtractFloorPlanParams,
	): Promise<ImageGenerationResult> {
		try {
			// Step 1: SAM-3で間取り図の領域を検出し抽出
			const { image: croppedImage } = await this.objectDetection.detectObjects({
				image_url: params.maisokuImageUrl,
				prompt: "floor plan",
				return_multiple_masks: true,
				include_scores: true,
				include_boxes: true,
			});

			if (!croppedImage) {
				return {
					image: null,
					error: "間取り図を検出できませんでした。",
				};
			}

			const croppedImageBlob = await ky.get(croppedImage.url).blob();

			const trimmedImageBlob = await sharp(
				Buffer.from(await croppedImageBlob.arrayBuffer()),
			)
				.trim()
				.toBuffer()
				.then(
					(b) => new Blob([new Uint8Array(b)], { type: croppedImageBlob.type }),
				);

			// クロップ画像を中間結果として保存
			const trimmedImageData: GeneratedImage = {
				blob: trimmedImageBlob,
				prompt: "クロップ済み間取り図",
			};

			// Step 3: クロップした間取り図を綺麗に再生成
			// console.log("Step 3: 間取り図を綺麗に再生成中...")
			const result = await this.regenerateFloorPlan(trimmedImageBlob);

			// 中間画像を結果に追加
			return {
				...result,
				intermediateImage: trimmedImageData,
			};
		} catch (error) {
			console.error("Failed to extract floor plan image:", error);
			return {
				image: null,
				error: extractErrorMessage(error),
			};
		}
	}

	/**
	 * クロップした間取り図を綺麗に再生成
	 * 重要: 間取り情報は正確に保持する必要がある
	 */
	private async regenerateFloorPlan(
		croppedImage: Blob,
	): Promise<ImageGenerationResult> {
		const prompt = `この画像は不動産チラシ（マイソク）からクロップした間取り図です。

【最重要: 正確性の厳守】
間取り図は不動産取引において極めて重要な情報です。
以下の情報は、元の画像から1文字たりとも変更してはいけません：

1. 【部屋名】完全に同一の表記を使用
   - 「LDK」「洋室」「和室」「DK」「K」「浴室」「トイレ」「洗面」「玄関」「バルコニー」等
   - 「洋室1」「洋室2」などの番号も正確に

2. 【面積表示】数値と単位を完全に一致させる
   - 「約16.6帖」なら「約16.6帖」のまま（「16.6帖」や「17帖」にしない）
   - 「6.0帖」なら「6.0帖」のまま（「6帖」にしない）
   - 「㎡」と「帖」を混同しない

3. 【部屋の配置・形状】
   - 各部屋の位置関係を正確に維持
   - 部屋の形状（L字型、長方形など）を変更しない
   - 壁の位置、ドア・窓の配置を正確に再現

4. 【設備の位置】
   - キッチン、浴槽、トイレ、洗面台等の配置を正確に
   - ドア（開き戸・引き戸）、窓の位置と向き

5. 【方位記号】元の画像にある場合のみ、同じ位置に同じ方向で含める

【スタイル】
- 白背景にクリアな線画
- 部屋ごとに薄いパステルカラーで色分け（水色、ピンク、クリーム色など）
- 線は黒またはダークグレー
- プロフェッショナルな不動産資料品質

【出力】
間取り図のみを、元のアスペクト比を維持して出力。
元の情報を絶対に改変しないこと。`;

		const base64 = await blobToBase64(croppedImage);
		const parts: Part[] = [
			{
				inlineData: {
					data: base64,
					mimeType: croppedImage.type || "image/png",
				},
			},
			{ text: prompt },
		];

		const contents: Content[] = [{ role: "user", parts }];

		const response = await this.ai.models.generateContent({
			model: "gemini-3-pro-image-preview",
			contents,
			config: {
				responseModalities: ["TEXT", "IMAGE"],
				imageConfig: {
					imageSize: IMAGE_SIZE,
				},
			},
		});

		return this.extractImageFromResponse(response, prompt);
	}

	/**
	 * 路線図イメージを生成
	 * アスペクト比: 16:9, サイズ: 2K
	 */
	async generateRouteMapImage(
		params: GenerateRouteMapParams,
	): Promise<ImageGenerationResult> {
		const aspectRatio = "16:9";

		try {
			// 路線情報をテキストに変換
			const routeDetails = params.routes
				.map((r) => {
					let detail = `・${r.destination}駅: ${r.durationMinutes}分`;
					if (r.transfers !== undefined) {
						detail += `（乗換${r.transfers}回）`;
					}
					if (r.viaLines && r.viaLines.length > 0) {
						detail += `【${r.viaLines.join("→")}】`;
					}
					return detail;
				})
				.join("\n");

			const prompt = `あなたは鉄道路線図をデザインする専門家です。

以下の交通情報をもとに、視覚的に美しく分かりやすい路線図イメージを生成してください。

【物件情報】
最寄り駅: ${params.nearestStation}駅
路線: ${params.lineName}
${params.propertyLocation ? `所在地: ${params.propertyLocation}` : ""}

【主要駅への所要時間】
${routeDetails}

【デザイン指示】
1. 最寄り駅を中心に配置し、主要駅への接続を視覚化
2. 各駅への所要時間を見やすく表示
3. 路線ごとに色分け（JR=緑、私鉄=各社のカラー、地下鉄=路線カラー）
4. シンプルでモダンなデザイン
5. 日本語で駅名と所要時間を記載

【スタイル】
- 白またはライトグレー背景
- 太い線で路線を表現
- 駅は丸または四角で表現
- 最寄り駅は強調表示（大きめ、色付き）
- フォントはサンセリフ系

【出力】
16:9の横長画像を生成してください。`;

			const parts: Part[] = [{ text: prompt }];
			const contents: Content[] = [{ role: "user", parts }];

			const response = await this.ai.models.generateContent({
				model: "gemini-3-pro-image-preview",
				contents,
				config: {
					responseModalities: ["TEXT", "IMAGE"],
					imageConfig: {
						aspectRatio,
						imageSize: IMAGE_SIZE,
					},
				},
			});

			return this.extractImageFromResponse(response, prompt, aspectRatio);
		} catch (error) {
			console.error("Failed to generate route map image:", error);
			return {
				image: null,
				error: extractErrorMessage(error),
			};
		}
	}

	/**
	 * Geminiのレスポンスから画像を抽出
	 */
	private extractImageFromResponse(
		response: Awaited<ReturnType<typeof this.ai.models.generateContent>>,
		prompt: string,
		aspectRatio?: string,
	): ImageGenerationResult {
		const candidates = response.candidates;
		if (!candidates || candidates.length === 0) {
			return {
				image: null,
				error: "画像を生成できませんでした（候補なし）。",
			};
		}

		const responseParts = candidates[0]?.content?.parts;
		if (!responseParts) {
			return {
				image: null,
				error: "画像を生成できませんでした（パーツなし）。",
			};
		}

		const imagePart = responseParts.find((part) =>
			part.inlineData?.mimeType?.startsWith("image/"),
		);

		if (!imagePart?.inlineData?.data) {
			return {
				image: null,
				error: "画像を生成できませんでした（画像データなし）。",
			};
		}

		const imageData = Buffer.from(imagePart.inlineData.data, "base64");

		const generatedImage: GeneratedImage = {
			blob: new Blob([imageData], {
				type: imagePart.inlineData.mimeType || "image/png",
			}),
			prompt,
			aspectRatio,
		};

		return {
			image: generatedImage,
			error: null,
		};
	}

	/**
	 * 住所から最寄り駅を検索
	 */
	async findNearestStation(
		address: string,
	): Promise<NearestStationInfo | null> {
		if (!this.placesClient || !this.routesClient) {
			console.error("Google Maps API client not initialized");
			return null;
		}

		try {
			// まず住所から座標を取得
			const [addressResponse] = await this.placesClient.searchText(
				{
					textQuery: address,
					languageCode: "ja",
					regionCode: "JP",
				},
				{
					otherArgs: {
						headers: {
							"X-Goog-FieldMask": "places.location,places.formattedAddress",
						},
					},
				},
			);

			const addressPlace = addressResponse.places?.[0];
			if (
				!addressPlace?.location?.latitude ||
				!addressPlace?.location?.longitude
			) {
				console.error("Address not found:", address);
				return null;
			}

			const propertyLat = addressPlace.location.latitude;
			const propertyLng = addressPlace.location.longitude;

			// 最寄り駅を検索
			const [stationResponse] = await this.placesClient.searchNearby(
				{
					locationRestriction: {
						circle: {
							center: { latitude: propertyLat, longitude: propertyLng },
							radius: 2000, // 2km以内
						},
					},
					includedTypes: ["train_station", "subway_station", "transit_station"],
					maxResultCount: 5,
					languageCode: "ja",
					regionCode: "JP",
				},
				{
					otherArgs: {
						headers: {
							"X-Goog-FieldMask":
								"places.id,places.displayName,places.location,places.formattedAddress",
						},
					},
				},
			);

			const stations = stationResponse.places ?? [];
			if (stations.length === 0) {
				console.error("No station found near:", address);
				return null;
			}

			// 最も近い駅を選択
			const nearestStation = stations[0];
			if (
				!nearestStation.location?.latitude ||
				!nearestStation.location?.longitude
			) {
				console.error(
					"Station location not found:",
					nearestStation.displayName,
				);
				return null;
			}
			const stationLat = nearestStation.location.latitude;
			const stationLng = nearestStation.location.longitude;

			// 徒歩時間を計算
			const [walkResponse] = await this.routesClient.computeRoutes(
				{
					origin: {
						location: {
							latLng: { latitude: propertyLat, longitude: propertyLng },
						},
					},
					destination: {
						location: {
							latLng: { latitude: stationLat, longitude: stationLng },
						},
					},
					travelMode: "WALK",
					computeAlternativeRoutes: false,
					languageCode: "ja",
				},
				{
					otherArgs: {
						headers: {
							"X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
						},
					},
				},
			);

			const walkRoute = walkResponse.routes?.[0];
			const distanceMeters = walkRoute?.distanceMeters ?? 0;
			const walkSeconds = Number(walkRoute?.duration?.seconds ?? 0);

			// 駅名から路線名を推測（簡易版）
			const stationName = nearestStation.displayName?.text ?? "";
			const lines = this.guessLineNames(stationName);

			return {
				name: stationName.replace(/駅$/, ""),
				lines,
				latitude: stationLat,
				longitude: stationLng,
				distanceMeters,
				walkMinutes: Math.ceil(walkSeconds / 60),
			};
		} catch (error) {
			console.error("Failed to find nearest station:", error);
			return null;
		}
	}

	/**
	 * 最寄り駅から主要駅への所要時間を取得
	 */
	async getRoutesToMajorStations(
		stationLocation: { latitude: number; longitude: number },
		majorStations?: MajorStation[],
	): Promise<RouteInfo[]> {
		if (!this.routesClient) {
			console.error("Google Maps API client not initialized");
			return [];
		}

		const stations = majorStations || DEFAULT_MAJOR_STATIONS;
		const routes: RouteInfo[] = [];

		// 並列でルート計算
		const routePromises = stations.map(async (station) => {
			try {
				if (!this.routesClient) {
					throw new Error("Routes client not initialized");
				}
				const [response] = await this.routesClient.computeRoutes(
					{
						origin: {
							location: {
								latLng: {
									latitude: stationLocation.latitude,
									longitude: stationLocation.longitude,
								},
							},
						},
						destination: {
							location: {
								latLng: {
									latitude: station.latitude,
									longitude: station.longitude,
								},
							},
						},
						travelMode: "TRANSIT",
						computeAlternativeRoutes: false,
						languageCode: "ja",
					},
					{
						otherArgs: {
							headers: {
								"X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
							},
						},
					},
				);

				const route = response.routes?.[0];
				if (route) {
					const durationSeconds = Number(route.duration?.seconds ?? 0);
					return {
						destination: station.name,
						durationMinutes: Math.ceil(durationSeconds / 60),
					};
				}
				return null;
			} catch (error) {
				console.error(`Failed to get route to ${station.name}:`, error);
				return null;
			}
		});

		const results = await Promise.all(routePromises);
		for (const result of results) {
			if (result) {
				routes.push(result);
			}
		}

		// 所要時間でソート
		routes.sort((a, b) => a.durationMinutes - b.durationMinutes);

		return routes;
	}

	/**
	 * 住所から路線情報を取得
	 */
	async getRouteDataFromAddress(
		params: GenerateRouteMapFromAddressParams,
	): Promise<RouteDataResult> {
		// 最寄り駅を検索
		const nearestStation = await this.findNearestStation(params.address);
		if (!nearestStation) {
			return {
				nearestStation: null,
				routes: [],
				error: "最寄り駅が見つかりませんでした。",
			};
		}

		// 主要駅への所要時間を取得
		const routes = await this.getRoutesToMajorStations(
			{
				latitude: nearestStation.latitude,
				longitude: nearestStation.longitude,
			},
			params.majorStations,
		);

		return {
			nearestStation,
			routes,
			error: null,
		};
	}

	/**
	 * 住所から路線図イメージを生成
	 * アスペクト比: 16:9, サイズ: 2K
	 */
	async generateRouteMapFromAddress(
		params: GenerateRouteMapFromAddressParams,
	): Promise<ImageGenerationResult> {
		// 路線情報を取得
		const routeData = await this.getRouteDataFromAddress(params);
		if (routeData.error || !routeData.nearestStation) {
			return {
				image: null,
				error: routeData.error || "路線情報を取得できませんでした。",
			};
		}

		// 路線図を生成
		return this.generateRouteMapImage({
			nearestStation: routeData.nearestStation.name,
			lineName: routeData.nearestStation.lines.join("・") || "不明",
			propertyLocation: params.address,
			routes: routeData.routes,
		});
	}

	/**
	 * 駅名から路線名を推測（簡易版）
	 */
	private guessLineNames(stationName: string): string[] {
		const lines: string[] = [];

		// 一般的な路線パターン
		if (stationName.includes("メトロ") || stationName.includes("地下鉄")) {
			lines.push("東京メトロ");
		}
		if (
			stationName.includes("JR") ||
			stationName.includes("山手") ||
			stationName.includes("中央")
		) {
			lines.push("JR");
		}
		if (
			stationName.includes("東急") ||
			stationName.includes("田園都市") ||
			stationName.includes("東横")
		) {
			lines.push("東急");
		}
		if (stationName.includes("小田急")) {
			lines.push("小田急");
		}
		if (stationName.includes("京王")) {
			lines.push("京王");
		}
		if (stationName.includes("西武")) {
			lines.push("西武");
		}
		if (stationName.includes("東武")) {
			lines.push("東武");
		}

		// 路線が特定できない場合
		if (lines.length === 0) {
			lines.push("鉄道");
		}

		return lines;
	}
}
