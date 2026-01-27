/**
 * Ekispert API 型定義
 *
 * 駅すぱあとWebサービス（Ekispert）のレスポンス型と
 * アプリケーション内で使用するデータモデルを定義
 */

// ========================================
// アプリケーション用データモデル
// ========================================

/**
 * 最寄り駅情報
 */
export interface NearestStation {
	/** 駅名 */
	name: string;
	/** 駅コード */
	code: string;
	/** 距離（メートル） */
	distance: number;
	/** 徒歩分数 */
	walkMinutes: number;
	/** 利用可能路線 */
	lines: string[];
}

/**
 * 経路結果
 */
export interface RouteResult {
	/** 到着駅名 */
	destination: string;
	/** 所要時間（分）- 最寄り駅から目的地駅まで */
	totalMinutes: number;
	/** 乗換回数 */
	transferCount: number;
	/** 経路概要（例: "南北線 → 丸ノ内線"） */
	routeSummary: string;
	/** 主要路線名（SVG表示用） */
	mainLine?: string;
}

/**
 * 路線図マップデータ
 */
export interface RouteMapData {
	/** 物件住所 */
	propertyAddress: string;
	/** 最寄り駅 */
	nearestStation: NearestStation;
	/** 主要駅への経路 */
	stationRoutes: RouteResult[];
	/** 空港への経路 */
	airportRoutes: RouteResult[];
}

// ========================================
// Ekispert API レスポンス型
// ========================================

/**
 * 駅情報（APIレスポンス）
 */
export interface EkispertStation {
	code: string;
	Name: string;
	Type?: string;
	Yomi?: string;
	GeoPoint?: {
		longi: string;
		lati: string;
		longi_d: string;
		lati_d: string;
	};
}

/**
 * 路線情報（APIレスポンス）
 */
export interface EkispertLine {
	Name: string;
	Type?: string;
	Color?: string;
}

/**
 * 住所から駅検索のレスポンス
 */
export interface AddressStationResponse {
	ResultSet: {
		apiVersion: string;
		engineVersion: string;
		Point?:
			| Array<{
					Station: EkispertStation;
					Distance?: string;
					GeoPoint?: {
						longi: string;
						lati: string;
					};
			  }>
			| {
					Station: EkispertStation;
					Distance?: string;
					GeoPoint?: {
						longi: string;
						lati: string;
					};
			  };
	};
}

/**
 * 駅の路線情報取得レスポンス
 */
export interface StationLinesResponse {
	ResultSet: {
		apiVersion: string;
		engineVersion: string;
		Line?: EkispertLine[] | EkispertLine;
		Information?: {
			Type: string;
			code: string;
		};
	};
}

/**
 * 経路探索のレスポンス
 */
export interface CourseSearchResponse {
	ResultSet: {
		apiVersion: string;
		engineVersion: string;
		Course?:
			| Array<{
					price?: Array<{
						Oneway: string;
						Round?: string;
						Type: string;
					}>;
					Route: {
						timeOnBoard: string;
						timeWalk: string;
						timeOther?: string;
						transferCount: string;
						distance?: string;
						Line?:
							| Array<{
									Name: string;
									Type?: string;
									Color?: string;
									DepartureState?: {
										Datetime?: { text: string };
									};
									ArrivalState?: {
										Datetime?: { text: string };
									};
							  }>
							| {
									Name: string;
									Type?: string;
									Color?: string;
							  };
						Point?: Array<{
							Station: EkispertStation;
							Prefecture?: { Name: string };
						}>;
					};
					SerializeData?: string;
			  }>
			| {
					price?: Array<{
						Oneway: string;
						Round?: string;
						Type: string;
					}>;
					Route: {
						timeOnBoard: string;
						timeWalk: string;
						timeOther?: string;
						transferCount: string;
						distance?: string;
						Line?:
							| Array<{
									Name: string;
									Type?: string;
									Color?: string;
							  }>
							| {
									Name: string;
									Type?: string;
									Color?: string;
							  };
						Point?: Array<{
							Station: EkispertStation;
							Prefecture?: { Name: string };
						}>;
					};
			  };
	};
}

// ========================================
// 主要駅・空港の定義
// ========================================

/**
 * 首都圏の主要ターミナル駅
 * エリア別に定義し、物件位置に応じて適切な駅を選択
 */
export const MAJOR_STATIONS = {
	// 東京都心エリア
	tokyo: [
		{ name: "東京", code: "22828" },
		{ name: "新宿", code: "22741" },
		{ name: "渋谷", code: "22715" },
		{ name: "池袋", code: "22513" },
		{ name: "品川", code: "22709" },
		{ name: "上野", code: "22528" },
	],
	// 神奈川エリア
	kanagawa: [
		{ name: "横浜", code: "23368" },
		{ name: "川崎", code: "23126" },
		{ name: "新横浜", code: "23212" },
	],
	// 埼玉エリア
	saitama: [{ name: "大宮", code: "21987" }],
	// 千葉エリア
	chiba: [
		{ name: "千葉", code: "22370" },
		{ name: "船橋", code: "22530" },
	],
} as const;

/**
 * 全主要駅のフラットリスト（後方互換性用）
 */
export const ALL_MAJOR_STATIONS = [
	...MAJOR_STATIONS.tokyo,
	...MAJOR_STATIONS.kanagawa,
	...MAJOR_STATIONS.saitama,
	...MAJOR_STATIONS.chiba,
] as const;

/**
 * エリア名の型
 */
export type AreaName = keyof typeof MAJOR_STATIONS;

/**
 * エリア別の検索対象エリアマッピング
 * 各エリアの物件に対して、どのエリアの駅を検索するかを定義
 * - 東京: 東京のみ
 * - 神奈川/埼玉/千葉: 自エリア + 東京
 */
export const AREA_SEARCH_MAPPING: Record<AreaName, AreaName[]> = {
	tokyo: ["tokyo"],
	kanagawa: ["kanagawa", "tokyo"],
	saitama: ["saitama", "tokyo"],
	chiba: ["chiba", "tokyo"],
};

/**
 * 住所からエリアを判定するためのキーワード
 */
export const AREA_KEYWORDS: Record<AreaName, string[]> = {
	tokyo: ["東京都", "東京"],
	kanagawa: ["神奈川県", "神奈川", "横浜市", "川崎市", "相模原市"],
	saitama: ["埼玉県", "埼玉", "さいたま市"],
	chiba: ["千葉県", "千葉"],
};

/**
 * 主要空港
 * 羽田: 京急の羽田空港第１・第２ターミナル駅 (KK17)
 * 成田: 成田空港(鉄道) - 第1ターミナル直結
 */
export const AIRPORTS = [
	{ name: "羽田空港", code: "22827", displayName: "羽田空港" },
	{ name: "成田空港(鉄道)", code: "22392", displayName: "成田空港" },
] as const;
