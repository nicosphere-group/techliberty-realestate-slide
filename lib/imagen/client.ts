/**
 * 不動産スライド用画像生成クライアント
 * Gemini 画像生成API (gemini-3-pro-image-preview) を使用
 */

import { GoogleGenAI, type Content, type Part } from "@google/genai"
import { PlacesClient } from "@googlemaps/places"
import { RoutesClient } from "@googlemaps/routing"
import sharp from "sharp"
import type {
  ImageGenerationResult,
  ExtractPropertyImageParams,
  ExtractFloorPlanParams,
  GenerateRouteMapParams,
  GenerateRouteMapFromAddressParams,
  GeneratedImage,
  MajorStation,
  NearestStationInfo,
  RouteInfo,
  RouteDataResult,
  FloorPlanBoundingBox,
  GeminiSegmentationResult,
} from "./types"

const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY

/** 東京近郊のデフォルト主要駅 */
const DEFAULT_MAJOR_STATIONS: MajorStation[] = [
  { name: "東京", latitude: 35.6812, longitude: 139.7671 },
  { name: "渋谷", latitude: 35.6580, longitude: 139.7016 },
  { name: "新宿", latitude: 35.6896, longitude: 139.7006 },
  { name: "池袋", latitude: 35.7295, longitude: 139.7109 },
  { name: "品川", latitude: 35.6284, longitude: 139.7387 },
  { name: "横浜", latitude: 35.4657, longitude: 139.6224 },
]

/** 画像サイズ: 2K固定 */
const IMAGE_SIZE = "2K" as const

/** Gemini画像生成APIでサポートされていないMIMEタイプ */
const UNSUPPORTED_MIME_TYPES = ["image/svg+xml", "image/gif"]

/**
 * URLから画像をダウンロードしてBase64に変換
 */
async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    // Data URL（base64）の場合は直接パース
    if (url.startsWith("data:")) {
      const matches = url.match(/^data:([^;]+);base64,(.+)$/)
      if (matches) {
        const mimeType = matches[1]
        if (UNSUPPORTED_MIME_TYPES.includes(mimeType)) {
          console.warn(`Skipping unsupported image format (data URL): ${mimeType}`)
          return null
        }
        return {
          mimeType,
          data: matches[2],
        }
      }
      console.warn("Invalid data URL format")
      return null
    }

    // HTTPリクエストで画像を取得
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${url}`)
      return null
    }

    let contentType = response.headers.get("content-type") || "image/jpeg"

    // 不明な形式の場合、URLから推測
    if (contentType === "application/octet-stream" || !contentType.startsWith("image/")) {
      const urlPath = url.split("?")[0].toLowerCase()
      if (urlPath.endsWith(".jpg") || urlPath.endsWith(".jpeg")) contentType = "image/jpeg"
      else if (urlPath.endsWith(".png")) contentType = "image/png"
      else if (urlPath.endsWith(".webp")) contentType = "image/webp"
      else {
        console.warn(`Skipping unknown content type: ${contentType} (${url})`)
        return null
      }
    }

    if (UNSUPPORTED_MIME_TYPES.includes(contentType)) {
      console.warn(`Skipping unsupported image format: ${contentType} (${url})`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    return {
      data: base64,
      mimeType: contentType,
    }
  } catch (error) {
    console.error(`Error fetching image: ${url}`, error)
    return null
  }
}

/**
 * エラーメッセージを日本語に変換
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message
    if (message.includes("SAFETY")) {
      return "安全性ポリシーにより画像を生成できませんでした。"
    }
    if (message.includes("RECITATION")) {
      return "著作権の問題により画像を生成できませんでした。"
    }
    if (message.includes("BLOCKED")) {
      return "コンテンツがブロックされました。"
    }
    if (message.includes("quota") || message.includes("QUOTA")) {
      return "APIの利用制限に達しました。"
    }
    if (message.includes("rate") || message.includes("RATE")) {
      return "リクエストが多すぎます。"
    }
    return message
  }
  return "画像生成に失敗しました。"
}

/**
 * 不動産スライド用画像生成クライアント
 */
export class RealEstateImagenClient {
  private ai: GoogleGenAI
  private placesClient: PlacesClient | null = null
  private routesClient: RoutesClient | null = null

  constructor(apiKey?: string, mapsApiKey?: string) {
    const key = apiKey || GEMINI_API_KEY
    if (!key) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set")
    }
    this.ai = new GoogleGenAI({ apiKey: key })

    // Google Maps APIクライアントの初期化（オプション）
    const mapsKey = mapsApiKey || GOOGLE_MAPS_API_KEY
    if (mapsKey) {
      this.placesClient = new PlacesClient({ apiKey: mapsKey })
      this.routesClient = new RoutesClient({ apiKey: mapsKey })
    }
  }

  /**
   * マイソク画像から物件写真を抽出
   * 2段階処理: 1) Vision APIで領域検出 → 2) Sharpでクロップ → 3) 綺麗に再生成
   */
  async extractPropertyImage(
    params: ExtractPropertyImageParams
  ): Promise<ImageGenerationResult> {
    const aspectRatio = "3:4"

    try {
      // マイソク画像を取得
      const maisokuImage = await fetchImageAsBase64(params.maisokuImageUrl)
      if (!maisokuImage) {
        return {
          image: null,
          error: "マイソク画像を取得できませんでした。",
        }
      }

      // Step 1: Vision APIで外観写真の領域を検出
      // console.log("Step 1: 外観写真の領域を検出中...")
      const boundingBox = await this.detectPropertyImageBoundingBox(maisokuImage)
      if (!boundingBox) {
        return {
          image: null,
          error: "外観写真を検出できませんでした。",
        }
      }
      // console.log("検出されたバウンディングボックス:", boundingBox)

      // Step 2: Sharpでクロップ
      // console.log("Step 2: 外観写真をクロップ中...")
      const croppedImage = await this.cropFloorPlan(maisokuImage, boundingBox)
      if (!croppedImage) {
        return {
          image: null,
          error: "外観写真のクロップに失敗しました。",
        }
      }

      // クロップ画像を中間結果として保存
      const croppedImageData: GeneratedImage = {
        imageData: Buffer.from(croppedImage.data, "base64"),
        mimeType: croppedImage.mimeType,
        prompt: "クロップ済み外観写真",
      }

      // Step 3: クロップした外観写真を綺麗に再生成
      // console.log("Step 3: 外観写真を綺麗に再生成中...")
      const result = await this.regeneratePropertyImage(croppedImage, aspectRatio)

      // 中間画像を結果に追加
      return {
        ...result,
        intermediateImage: croppedImageData,
      }
    } catch (error) {
      console.error("Failed to extract property image:", error)
      return {
        image: null,
        error: extractErrorMessage(error),
      }
    }
  }

  /**
   * Vision APIで外観写真のバウンディングボックスを検出
   * Gemini公式セグメンテーション形式を使用
   */
  private async detectPropertyImageBoundingBox(
    imageData: { data: string; mimeType: string }
  ): Promise<FloorPlanBoundingBox | null> {
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

Return empty array [] if no exterior photo is found.`

    const parts: Part[] = [
      {
        inlineData: {
          data: imageData.data,
          mimeType: imageData.mimeType,
        },
      },
      { text: prompt },
    ]

    const contents: Content[] = [{ role: "user", parts }]

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        responseModalities: ["TEXT"],
        thinkingConfig: {
          thinkingBudget: 0, // オブジェクト検出に最適化
        },
      },
    })

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error("No text response from bounding box detection")
      return null
    }

    // console.log("Property image detection response:", text)

    try {
      // JSONを抽出（マークダウンのコードブロックを考慮）
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.error("No JSON array found in response:", text)
        return null
      }

      const results: GeminiSegmentationResult[] = JSON.parse(jsonMatch[0])
      if (results.length === 0) {
        console.error("No property image found in the maisoku")
        return null
      }

      // 最初の結果を使用（最も大きい外観写真）
      const result = results[0]
      const [y0, x0, y1, x1] = result.box_2d

      // 値のバリデーション（0-1000の範囲）
      if (
        y0 < 0 || y0 > 1000 || x0 < 0 || x0 > 1000 ||
        y1 < 0 || y1 > 1000 || x1 < 0 || x1 > 1000 ||
        y0 >= y1 || x0 >= x1
      ) {
        console.error("Invalid bounding box values:", result.box_2d)
        return null
      }

      // 0-1000座標を0-1座標に変換
      const x = x0 / 1000
      const y = y0 / 1000
      const width = (x1 - x0) / 1000
      const height = (y1 - y0) / 1000

      // パディングを追加（3%）して切れを防止
      const padding = 0.03
      const paddedX = Math.max(0, x - padding)
      const paddedY = Math.max(0, y - padding)
      const paddedWidth = Math.min(1 - paddedX, width + padding * 2)
      const paddedHeight = Math.min(1 - paddedY, height + padding * 2)

      // console.log("Detected label:", result.label)
      // console.log("Original box_2d:", result.box_2d)
      // console.log("Converted bbox:", { x, y, width, height })
      // console.log("Padded bbox:", { x: paddedX, y: paddedY, width: paddedWidth, height: paddedHeight })

      return { x: paddedX, y: paddedY, width: paddedWidth, height: paddedHeight }
    } catch (error) {
      console.error("Failed to parse bounding box JSON:", error, text)
      return null
    }
  }

  /**
   * クロップした外観写真を綺麗に再生成
   */
  private async regeneratePropertyImage(
    croppedImage: { data: string; mimeType: string },
    aspectRatio: string
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
3:4の縦長画像で、建物の外観のみを出力してください。`

    const parts: Part[] = [
      {
        inlineData: {
          data: croppedImage.data,
          mimeType: croppedImage.mimeType,
        },
      },
      { text: prompt },
    ]

    const contents: Content[] = [{ role: "user", parts }]

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
    })

    return this.extractImageFromResponse(response, prompt, aspectRatio)
  }

  /**
   * マイソク画像から間取り図を抽出
   * 2段階処理: 1) Vision APIで領域検出 → 2) Sharpでクロップ → 3) 綺麗に再生成
   */
  async extractFloorPlanImage(
    params: ExtractFloorPlanParams
  ): Promise<ImageGenerationResult> {
    try {
      // マイソク画像を取得
      const maisokuImage = await fetchImageAsBase64(params.maisokuImageUrl)
      if (!maisokuImage) {
        return {
          image: null,
          error: "マイソク画像を取得できませんでした。",
        }
      }

      // Step 1: Vision APIで間取り図の領域を検出
      // console.log("Step 1: 間取り図の領域を検出中...")
      const boundingBox = await this.detectFloorPlanBoundingBox(maisokuImage)
      if (!boundingBox) {
        return {
          image: null,
          error: "間取り図を検出できませんでした。",
        }
      }
      // console.log("検出されたバウンディングボックス:", boundingBox)

      // Step 2: Sharpでクロップ
      // console.log("Step 2: 間取り図をクロップ中...")
      const croppedImage = await this.cropFloorPlan(maisokuImage, boundingBox)
      if (!croppedImage) {
        return {
          image: null,
          error: "間取り図のクロップに失敗しました。",
        }
      }

      // クロップ画像を中間結果として保存
      const croppedImageData: GeneratedImage = {
        imageData: Buffer.from(croppedImage.data, "base64"),
        mimeType: croppedImage.mimeType,
        prompt: "クロップ済み間取り図",
      }

      // Step 3: クロップした間取り図を綺麗に再生成
      // console.log("Step 3: 間取り図を綺麗に再生成中...")
      const result = await this.regenerateFloorPlan(croppedImage)
      
      // 中間画像を結果に追加
      return {
        ...result,
        intermediateImage: croppedImageData,
      }
    } catch (error) {
      console.error("Failed to extract floor plan image:", error)
      return {
        image: null,
        error: extractErrorMessage(error),
      }
    }
  }

  /**
   * Vision APIで間取り図のバウンディングボックスを検出
   * Gemini公式セグメンテーション形式を使用
   */
  private async detectFloorPlanBoundingBox(
    imageData: { data: string; mimeType: string }
  ): Promise<FloorPlanBoundingBox | null> {
    const prompt = `あなたは不動産チラシ（マイソク）の画像解析エキスパートです。
この画像から間取り図（フロアプラン）を正確に検出してください。

【間取り図の特徴】
- 部屋のレイアウトを上から見た図面
- 各部屋の配置、壁、ドア、窓が線画で描かれている
- 部屋名（LDK、洋室、和室、浴室、トイレなど）が記載されている
- 面積（帖数、㎡）が記載されていることが多い
- 方位記号（N）が含まれていることが多い
- 「間取り」というラベルが付いていることがある

【除外対象】
- 建物の外観写真
- 室内写真（リビング、キッチン、浴室などの実際の写真）
- 地図・周辺案内図・アクセスマップ
- 物件概要テキスト・価格表
- 設備一覧表
- 小さなサムネイル画像

【選択基準】
1. メインの大きな間取り図を最優先で選ぶ
2. 複数の間取り図がある場合は、最も大きいサイズのものを1つだけ選ぶ
3. 間取り図の図面部分のみを囲む（周囲のテキストや凡例は含めない）
4. 間取り図が見つからない場合は空の配列を返す

【座標の精度】
- 間取り図の図面領域を正確に検出する
- 周囲の物件情報テキスト、価格、その他の情報は含めない
- 間取り図1つだけをぴったり囲むバウンディングボックスを返す
- 部屋名・面積表示は間取り図の一部として含めて良い

【出力形式】
Output a JSON list where each entry contains:
- "box_2d": [y0, x0, y1, x1] with normalized coordinates from 0 to 1000
- "label": descriptive label (e.g., "floor_plan", "間取り図", "2LDK")

Return empty array [] if no floor plan is found.`

    const parts: Part[] = [
      {
        inlineData: {
          data: imageData.data,
          mimeType: imageData.mimeType,
        },
      },
      { text: prompt },
    ]

    const contents: Content[] = [{ role: "user", parts }]

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        responseModalities: ["TEXT"],
        thinkingConfig: {
          thinkingBudget: 0, // オブジェクト検出に最適化
        },
      },
    })

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error("No text response from bounding box detection")
      return null
    }

    // console.log("Floor plan detection response:", text)

    try {
      // JSONを抽出（マークダウンのコードブロックを考慮）
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        console.error("No JSON array found in response:", text)
        return null
      }

      const results: GeminiSegmentationResult[] = JSON.parse(jsonMatch[0])
      if (results.length === 0) {
        console.error("No floor plan found in the maisoku")
        return null
      }

      // 最初の結果を使用（最も大きい間取り図）
      const result = results[0]
      const [y0, x0, y1, x1] = result.box_2d

      // 値のバリデーション（0-1000の範囲）
      if (
        y0 < 0 || y0 > 1000 || x0 < 0 || x0 > 1000 ||
        y1 < 0 || y1 > 1000 || x1 < 0 || x1 > 1000 ||
        y0 >= y1 || x0 >= x1
      ) {
        console.error("Invalid bounding box values:", result.box_2d)
        return null
      }

      // 0-1000座標を0-1座標に変換
      const x = x0 / 1000
      const y = y0 / 1000
      const width = (x1 - x0) / 1000
      const height = (y1 - y0) / 1000

      // パディングを追加（3%）して切れを防止
      const padding = 0.03
      const paddedX = Math.max(0, x - padding)
      const paddedY = Math.max(0, y - padding)
      const paddedWidth = Math.min(1 - paddedX, width + padding * 2)
      const paddedHeight = Math.min(1 - paddedY, height + padding * 2)

      // console.log("Detected label:", result.label)
      // console.log("Original box_2d:", result.box_2d)
      // console.log("Converted bbox:", { x, y, width, height })
      // console.log("Padded bbox:", { x: paddedX, y: paddedY, width: paddedWidth, height: paddedHeight })

      return { x: paddedX, y: paddedY, width: paddedWidth, height: paddedHeight }
    } catch (error) {
      console.error("Failed to parse bounding box JSON:", error, text)
      return null
    }
  }

  /**
   * Sharpを使って画像をクロップ
   */
  private async cropFloorPlan(
    imageData: { data: string; mimeType: string },
    bbox: FloorPlanBoundingBox
  ): Promise<{ data: string; mimeType: string } | null> {
    try {
      const inputBuffer = Buffer.from(imageData.data, "base64")
      
      // 画像のメタデータを取得
      const metadata = await sharp(inputBuffer).metadata()
      const imageWidth = metadata.width || 0
      const imageHeight = metadata.height || 0

      if (imageWidth === 0 || imageHeight === 0) {
        console.error("Invalid image dimensions")
        return null
      }

      // 正規化座標からピクセル座標に変換
      const left = Math.round(bbox.x * imageWidth)
      const top = Math.round(bbox.y * imageHeight)
      const width = Math.round(bbox.width * imageWidth)
      const height = Math.round(bbox.height * imageHeight)

      // クロップ実行
      const croppedBuffer = await sharp(inputBuffer)
        .extract({ left, top, width, height })
        .png()
        .toBuffer()

      return {
        data: croppedBuffer.toString("base64"),
        mimeType: "image/png",
      }
    } catch (error) {
      console.error("Failed to crop image:", error)
      return null
    }
  }

  /**
   * クロップした間取り図を綺麗に再生成
   * 重要: 間取り情報は正確に保持する必要がある
   */
  private async regenerateFloorPlan(
    croppedImage: { data: string; mimeType: string }
  ): Promise<ImageGenerationResult> {
    const prompt = `この画像は不動産チラシ（マイソク）からクロップした間取り図です。
クロップの際に周囲の情報（ラベル、物件情報、他の写真など）が含まれている可能性があります。

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

【除外するもの】
- 「間取り」「Floor Plan」「PLAN」などのラベル・見出し
- 物件名、価格、物件概要などの周辺テキスト
- 間取り図の外側にある凡例や注釈
- 他の写真や画像

【スタイル】
- 白背景にクリアな線画
- 部屋ごとに薄いパステルカラーで色分け（水色、ピンク、クリーム色など）
- 線は黒またはダークグレー
- プロフェッショナルな不動産資料品質

【出力】
間取り図のみを、元のアスペクト比を維持して出力。
元の情報を絶対に改変しないこと。`

    const parts: Part[] = [
      {
        inlineData: {
          data: croppedImage.data,
          mimeType: croppedImage.mimeType,
        },
      },
      { text: prompt },
    ]

    const contents: Content[] = [{ role: "user", parts }]

    const response = await this.ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          imageSize: IMAGE_SIZE,
        },
      },
    })

    return this.extractImageFromResponse(response, prompt)
  }

  /**
   * 路線図イメージを生成
   * アスペクト比: 16:9, サイズ: 2K
   */
  async generateRouteMapImage(
    params: GenerateRouteMapParams
  ): Promise<ImageGenerationResult> {
    const aspectRatio = "16:9"

    try {
      // 路線情報をテキストに変換
      const routeDetails = params.routes
        .map((r) => {
          let detail = `・${r.destination}駅: ${r.durationMinutes}分`
          if (r.transfers !== undefined) {
            detail += `（乗換${r.transfers}回）`
          }
          if (r.viaLines && r.viaLines.length > 0) {
            detail += `【${r.viaLines.join("→")}】`
          }
          return detail
        })
        .join("\n")

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
16:9の横長画像を生成してください。`

      const parts: Part[] = [{ text: prompt }]
      const contents: Content[] = [{ role: "user", parts }]

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
      })

      return this.extractImageFromResponse(response, prompt, aspectRatio)
    } catch (error) {
      console.error("Failed to generate route map image:", error)
      return {
        image: null,
        error: extractErrorMessage(error),
      }
    }
  }

  /**
   * Geminiのレスポンスから画像を抽出
   */
  private extractImageFromResponse(
    response: Awaited<ReturnType<typeof this.ai.models.generateContent>>,
    prompt: string,
    aspectRatio?: string
  ): ImageGenerationResult {
    const candidates = response.candidates
    if (!candidates || candidates.length === 0) {
      return {
        image: null,
        error: "画像を生成できませんでした（候補なし）。",
      }
    }

    const responseParts = candidates[0]?.content?.parts
    if (!responseParts) {
      return {
        image: null,
        error: "画像を生成できませんでした（パーツなし）。",
      }
    }

    const imagePart = responseParts.find((part) =>
      part.inlineData?.mimeType?.startsWith("image/")
    )

    if (!imagePart?.inlineData?.data) {
      return {
        image: null,
        error: "画像を生成できませんでした（画像データなし）。",
      }
    }

    const imageData = Buffer.from(imagePart.inlineData.data, "base64")

    const generatedImage: GeneratedImage = {
      imageData,
      mimeType: imagePart.inlineData.mimeType || "image/png",
      prompt,
      aspectRatio,
    }

    return {
      image: generatedImage,
      error: null,
    }
  }

  /**
   * 住所から最寄り駅を検索
   */
  async findNearestStation(address: string): Promise<NearestStationInfo | null> {
    if (!this.placesClient || !this.routesClient) {
      console.error("Google Maps API client not initialized")
      return null
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
        }
      )

      const addressPlace = addressResponse.places?.[0]
      if (!addressPlace?.location) {
        console.error("Address not found:", address)
        return null
      }

      const propertyLat = addressPlace.location.latitude!
      const propertyLng = addressPlace.location.longitude!

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
        }
      )

      const stations = stationResponse.places ?? []
      if (stations.length === 0) {
        console.error("No station found near:", address)
        return null
      }

      // 最も近い駅を選択
      const nearestStation = stations[0]
      const stationLat = nearestStation.location?.latitude!
      const stationLng = nearestStation.location?.longitude!

      // 徒歩時間を計算
      const [walkResponse] = await this.routesClient.computeRoutes(
        {
          origin: {
            location: { latLng: { latitude: propertyLat, longitude: propertyLng } },
          },
          destination: {
            location: { latLng: { latitude: stationLat, longitude: stationLng } },
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
        }
      )

      const walkRoute = walkResponse.routes?.[0]
      const distanceMeters = walkRoute?.distanceMeters ?? 0
      const walkSeconds = Number(walkRoute?.duration?.seconds ?? 0)

      // 駅名から路線名を推測（簡易版）
      const stationName = nearestStation.displayName?.text ?? ""
      const lines = this.guessLineNames(stationName)

      return {
        name: stationName.replace(/駅$/, ""),
        lines,
        latitude: stationLat,
        longitude: stationLng,
        distanceMeters,
        walkMinutes: Math.ceil(walkSeconds / 60),
      }
    } catch (error) {
      console.error("Failed to find nearest station:", error)
      return null
    }
  }

  /**
   * 最寄り駅から主要駅への所要時間を取得
   */
  async getRoutesToMajorStations(
    stationLocation: { latitude: number; longitude: number },
    majorStations?: MajorStation[]
  ): Promise<RouteInfo[]> {
    if (!this.routesClient) {
      console.error("Google Maps API client not initialized")
      return []
    }

    const stations = majorStations || DEFAULT_MAJOR_STATIONS
    const routes: RouteInfo[] = []

    // 並列でルート計算
    const routePromises = stations.map(async (station) => {
      try {
        const [response] = await this.routesClient!.computeRoutes(
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
          }
        )

        const route = response.routes?.[0]
        if (route) {
          const durationSeconds = Number(route.duration?.seconds ?? 0)
          return {
            destination: station.name,
            durationMinutes: Math.ceil(durationSeconds / 60),
          }
        }
        return null
      } catch (error) {
        console.error(`Failed to get route to ${station.name}:`, error)
        return null
      }
    })

    const results = await Promise.all(routePromises)
    for (const result of results) {
      if (result) {
        routes.push(result)
      }
    }

    // 所要時間でソート
    routes.sort((a, b) => a.durationMinutes - b.durationMinutes)

    return routes
  }

  /**
   * 住所から路線情報を取得
   */
  async getRouteDataFromAddress(
    params: GenerateRouteMapFromAddressParams
  ): Promise<RouteDataResult> {
    // 最寄り駅を検索
    const nearestStation = await this.findNearestStation(params.address)
    if (!nearestStation) {
      return {
        nearestStation: null,
        routes: [],
        error: "最寄り駅が見つかりませんでした。",
      }
    }

    // 主要駅への所要時間を取得
    const routes = await this.getRoutesToMajorStations(
      { latitude: nearestStation.latitude, longitude: nearestStation.longitude },
      params.majorStations
    )

    return {
      nearestStation,
      routes,
      error: null,
    }
  }

  /**
   * 住所から路線図イメージを生成
   * アスペクト比: 16:9, サイズ: 2K
   */
  async generateRouteMapFromAddress(
    params: GenerateRouteMapFromAddressParams
  ): Promise<ImageGenerationResult> {
    // 路線情報を取得
    const routeData = await this.getRouteDataFromAddress(params)
    if (routeData.error || !routeData.nearestStation) {
      return {
        image: null,
        error: routeData.error || "路線情報を取得できませんでした。",
      }
    }

    // 路線図を生成
    return this.generateRouteMapImage({
      nearestStation: routeData.nearestStation.name,
      lineName: routeData.nearestStation.lines.join("・") || "不明",
      propertyLocation: params.address,
      routes: routeData.routes,
    })
  }

  /**
   * 駅名から路線名を推測（簡易版）
   */
  private guessLineNames(stationName: string): string[] {
    const lines: string[] = []

    // 一般的な路線パターン
    if (stationName.includes("メトロ") || stationName.includes("地下鉄")) {
      lines.push("東京メトロ")
    }
    if (stationName.includes("JR") || stationName.includes("山手") || stationName.includes("中央")) {
      lines.push("JR")
    }
    if (stationName.includes("東急") || stationName.includes("田園都市") || stationName.includes("東横")) {
      lines.push("東急")
    }
    if (stationName.includes("小田急")) {
      lines.push("小田急")
    }
    if (stationName.includes("京王")) {
      lines.push("京王")
    }
    if (stationName.includes("西武")) {
      lines.push("西武")
    }
    if (stationName.includes("東武")) {
      lines.push("東武")
    }

    // 路線が特定できない場合
    if (lines.length === 0) {
      lines.push("鉄道")
    }

    return lines
  }
}
