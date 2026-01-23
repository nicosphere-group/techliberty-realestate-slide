/**
 * 不動産スライド用画像生成の型定義
 */

/** 生成された画像 */
export interface GeneratedImage {
	/** 画像データ (Buffer) */
	imageData: Buffer;
	/** MIMEタイプ */
	mimeType: string;
	/** 生成に使用したプロンプト */
	prompt: string;
	/** アスペクト比（指定なしの場合はundefined） */
	aspectRatio?: string;
}

/** 画像生成結果 */
export interface ImageGenerationResult {
	/** 成功した場合の画像 */
	image: GeneratedImage | null;
	/** エラーメッセージ（失敗時） */
	error: string | null;
	/** 中間処理画像（クロップ後など、デバッグ用） */
	intermediateImage?: GeneratedImage;
}

/** 物件画像抽出パラメータ */
export interface ExtractPropertyImageParams {
	/** マイソク画像のURL or Base64 */
	maisokuImageUrl: string;
}

/** 間取り図抽出パラメータ */
export interface ExtractFloorPlanParams {
	/** マイソク画像のURL or Base64 */
	maisokuImageUrl: string;
}

/** 間取り図バウンディングボックス（内部形式） */
export interface FloorPlanBoundingBox {
	/** 左上X座標（0-1の正規化座標） */
	x: number;
	/** 左上Y座標（0-1の正規化座標） */
	y: number;
	/** 幅（0-1の正規化座標） */
	width: number;
	/** 高さ（0-1の正規化座標） */
	height: number;
}

/** Gemini公式セグメンテーション形式のバウンディングボックス */
export interface GeminiSegmentationResult {
	/** バウンディングボックス [y0, x0, y1, x1] 形式、0-1000の正規化座標 */
	box_2d: [number, number, number, number];
	/** セグメンテーションマスク（base64エンコードされたPNG） */
	mask?: string;
	/** ラベル */
	label: string;
}

/** 路線図生成パラメータ */
export interface GenerateRouteMapParams {
	/** 物件の最寄り駅 */
	nearestStation: string;
	/** 路線名 */
	lineName: string;
	/** 主要駅への所要時間リスト */
	routes: RouteInfo[];
	/** 物件所在地（参考情報） */
	propertyLocation?: string;
}

/** 路線情報 */
export interface RouteInfo {
	/** 目的駅名 */
	destination: string;
	/** 所要時間（分） */
	durationMinutes: number;
	/** 乗り換え回数 */
	transfers?: number;
	/** 経由路線 */
	viaLines?: string[];
}

/** 住所から路線図生成パラメータ */
export interface GenerateRouteMapFromAddressParams {
	/** 物件の住所 */
	address: string;
	/** 主要駅リスト（省略時はデフォルトの主要駅を使用） */
	majorStations?: MajorStation[];
}

/** 主要駅定義 */
export interface MajorStation {
	/** 駅名 */
	name: string;
	/** 緯度 */
	latitude: number;
	/** 経度 */
	longitude: number;
}

/** 最寄り駅情報 */
export interface NearestStationInfo {
	/** 駅名 */
	name: string;
	/** 路線名（複数の場合あり） */
	lines: string[];
	/** 緯度 */
	latitude: number;
	/** 経度 */
	longitude: number;
	/** 物件からの距離（メートル） */
	distanceMeters: number;
	/** 物件からの徒歩時間（分） */
	walkMinutes: number;
}

/** 路線情報取得結果 */
export interface RouteDataResult {
	/** 最寄り駅情報 */
	nearestStation: NearestStationInfo | null;
	/** 主要駅への所要時間 */
	routes: RouteInfo[];
	/** エラーメッセージ */
	error: string | null;
}
