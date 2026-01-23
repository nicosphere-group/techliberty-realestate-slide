/**
 * 不動産取引価格情報関連のツール定義
 * スライド6（価格分析）で使用
 * データソース: 国土交通省 REINFO API
 */
import { tool } from "ai";
import { z } from "zod";
import { CSISGeocoder } from "@/lib/geocode";
import { ReinfoClient } from "@/lib/reinfo/client";

const REINFO_API_KEY = process.env.REINFO_API_KEY;

// シングルトンインスタンス
let reinfoClient: ReinfoClient | null = null;

function getReinfoClient(): ReinfoClient {
	if (!reinfoClient) {
		const apiKey = REINFO_API_KEY;
		if (!apiKey) {
			throw new Error("REINFO_API_KEY is not set");
		}
		reinfoClient = new ReinfoClient({ apiKey });
	}
	return reinfoClient;
}

/**
 * 価格情報取得スキーマ
 */
const priceInfoSchema = z.object({
	year: z.number().int().min(2005).describe("西暦年（2005年以降）"),
	quarter: z
		.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
		.optional()
		.describe("四半期（1-4）。省略時は年間全体。"),
	area: z.string().describe("都道府県コード（例: '13' = 東京都）"),
	city: z
		.string()
		.optional()
		.describe("市区町村コード（例: '13101' = 千代田区）"),
	station: z.string().optional().describe("最寄り駅名"),
	priceClassification: z
		.enum(["01", "02"])
		.optional()
		.describe("取引価格種別。01=土地、02=中古マンション等"),
});

type PriceInfoParams = z.infer<typeof priceInfoSchema>;

/**
 * 不動産取引価格情報取得ツール
 * 国土交通省REINFO APIを使用
 */
export const getPriceInfoTool = tool({
	description:
		"不動産取引価格情報を取得します（国土交通省REINFO API）。周辺相場の比較や価格分析に使用します。",
	inputSchema: priceInfoSchema,
	execute: async (params: PriceInfoParams) => {
		const client = getReinfoClient();
		const result = await client.getPriceInfo(params);

		return {
			count: result.data.length,
			transactions: result.data,
		};
	},
});

/**
 * 市区町村コード取得スキーマ
 */
const municipalitiesSchema = z.object({
	area: z.string().describe("都道府県コード（例: '13' = 東京都）"),
});

type MunicipalitiesParams = z.infer<typeof municipalitiesSchema>;

/**
 * 市区町村コード一覧取得ツール
 */
export const getMunicipalitiesTool = tool({
	description:
		"指定した都道府県内の市区町村コード一覧を取得します。価格情報検索の前処理として使用します。",
	inputSchema: municipalitiesSchema,
	execute: async (params: MunicipalitiesParams) => {
		const client = getReinfoClient();
		const result = await client.getMunicipalities(params);

		return {
			municipalities: result.data,
		};
	},
});

// ========================================
// XPT001 - 価格ポイントAPI関連
// ========================================

/**
 * 緯度経度からタイル座標を計算
 * XYZ方式（Webメルカトル）
 */
function latLonToTile(
	lat: number,
	lon: number,
	zoom: number,
): { x: number; y: number; z: number } {
	const n = 2 ** zoom;
	const x = Math.floor(((lon + 180) / 360) * n);
	const latRad = (lat * Math.PI) / 180;
	const y = Math.floor(
		((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
	);
	return { x, y, z: zoom };
}

/**
 * 現在日付から期間パラメータ(from/to)を計算
 * 形式: YYYYQ (例: 20241 = 2024年Q1)
 */
function calculatePeriodParams(yearsBack: number = 5): {
	from: number;
	to: number;
} {
	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;
	const currentQuarter = Math.ceil(currentMonth / 3);

	const to = currentYear * 10 + currentQuarter;
	const fromYear = currentYear - yearsBack;
	const from = fromYear * 10 + 1; // 開始は常にQ1

	return { from, to };
}

/**
 * 類似物件データの型定義
 */
export interface SimilarProperty {
	name: string;
	age: string;
	area: string;
	price: string;
	unitPrice: string;
	transactionPeriod?: string;
}

/**
 * 対象物件データの型定義
 */
export interface TargetProperty {
	name: string;
	age: string;
	area: string;
	price: string;
	unitPrice: string;
}

/**
 * 価格分析結果の型定義
 */
export interface PriceAnalysisResult {
	targetProperty?: TargetProperty;
	similarProperties: SimilarProperty[];
	estimatedPriceMin: string;
	estimatedPriceMax: string;
	averageUnitPrice: number;
	dataCount: number;
}

/**
 * 対象物件の入力情報
 */
export interface TargetPropertyInput {
	name?: string;
	price?: string;
	area?: string;
	constructionYear?: string;
}

/**
 * 住所から周辺の中古マンション取引データを取得
 * XPT001 APIを使用
 */
export async function fetchNearbyTransactions(
	address: string,
	options: {
		zoom?: number;
		yearsBack?: number;
		maxResults?: number;
		targetPropertyInput?: TargetPropertyInput;
	} = {},
): Promise<PriceAnalysisResult> {
	const {
		zoom = 14,
		yearsBack = 5,
		maxResults = 6,
		targetPropertyInput,
	} = options;

	// 1. ジオコーディング：住所から緯度経度を取得
	const geocoder = new CSISGeocoder();
	const geocodeResults = await geocoder.geocode(address);

	if (geocodeResults.length === 0) {
		throw new Error(`住所が見つかりません: ${address}`);
	}

	const { latitude, longitude } = geocodeResults[0].coordinates;

	// 2. タイル座標を計算
	const tile = latLonToTile(latitude, longitude, zoom);

	// 3. 期間パラメータを計算
	const { from, to } = calculatePeriodParams(yearsBack);

	// 4. REINFO API呼び出し
	const client = getReinfoClient();
	const response = await client.getPricePoints({
		z: tile.z,
		x: tile.x,
		y: tile.y,
		from,
		to,
		landTypeCode: "07", // 中古マンション等
	});

	// 5. GeoJSONからデータを抽出
	const features = (response.data as { features?: unknown[] })?.features ?? [];

	if (features.length === 0) {
		return {
			similarProperties: [],
			estimatedPriceMin: "-",
			estimatedPriceMax: "-",
			averageUnitPrice: 0,
			dataCount: 0,
		};
	}

	// 6. データを整形
	const currentYear = new Date().getFullYear();
	type FeatureProperties = Record<string, unknown>;
	const transactions = features
		.map((feature: unknown) => {
			const props =
				(feature as { properties?: FeatureProperties })?.properties ?? {};

			// 建築年から築年数を計算
			const constructionYearStr = String(props.u_construction_year_ja ?? "");
			const constructionYearMatch = constructionYearStr.match(/(\d{4})/);
			const constructionYear = constructionYearMatch
				? Number(constructionYearMatch[1])
				: null;
			const buildingAge = constructionYear
				? currentYear - constructionYear
				: null;

			// 価格を数値に変換（万円単位）
			const priceStr = String(props.u_transaction_price_total_ja ?? "");
			const priceNum = Number(priceStr.replace(/[^0-9]/g, "")) || 0;

			// 面積を数値に変換
			const areaStr = String(props.u_area_ja ?? "");
			const areaNum = Number(areaStr.replace(/[^0-9.]/g, "")) || 0;

			// 坪単価を取得または計算
			let unitPriceNum = 0;
			const unitPriceStr = String(props.u_unit_price_per_tsubo_ja ?? "");
			const unitPriceFromApi = Number(unitPriceStr.replace(/[^0-9]/g, "")) || 0;

			if (unitPriceFromApi > 0) {
				// APIから坪単価が提供されている場合
				unitPriceNum = unitPriceFromApi;
			} else if (priceNum > 0 && areaNum > 0) {
				// APIに坪単価がない場合は計算する
				// 坪単価（万円/坪） = 価格（万円） ÷ 面積（坪）
				// 面積（坪） = 面積（㎡） × 0.3025
				const areaTsubo = areaNum * 0.3025;
				unitPriceNum = Math.round(priceNum / areaTsubo);
			}

			// 物件名: 地区名 + 構造 + 間取り
			const districtName = String(props.district_name_ja ?? "");
			const structure = String(props.building_structure_name_ja ?? "");
			const floorPlan = String(props.floor_plan_name_ja ?? "");
			const structurePart = structure ? ` ${structure}造` : "";
			const floorPlanPart = floorPlan ? ` ${floorPlan}` : "";
			const name =
				`${districtName}${structurePart}${floorPlanPart}`.trim() || "物件";

			return {
				name,
				age: buildingAge !== null ? String(buildingAge) : "-",
				area: areaNum > 0 ? String(Math.round(areaNum)) : "-",
				price: priceNum > 0 ? priceNum.toLocaleString() : "-",
				unitPrice: unitPriceNum > 0 ? unitPriceNum.toLocaleString() : "-",
				transactionPeriod: String(
					props.u_transaction_period_ja ?? props.transaction_period ?? "",
				),
				// ソート用に数値化
				_unitPriceNum: unitPriceNum,
				_priceNum: priceNum,
				_periodNum:
					Number(
						String(
							props.u_transaction_period_ja ?? props.transaction_period ?? "0",
						).replace(/[^0-9]/g, ""),
					) || 0,
			};
		})
		.filter((t) => t._unitPriceNum > 0); // 坪単価がないデータは除外

	// 7. 取引時期でソート（新しい順）
	transactions.sort((a, b) => b._periodNum - a._periodNum);

	// 8. 上位N件を取得
	const topTransactions = transactions.slice(0, maxResults);

	// 9. 推定価格範囲を計算（表示される上位N件の実際の販売価格から算出）
	const topPrices = topTransactions
		.map((t) => t._priceNum)
		.filter((p) => p > 0);
	const topUnitPrices = topTransactions
		.map((t) => t._unitPriceNum)
		.filter((p) => p > 0);

	const avgUnitPrice =
		topUnitPrices.length > 0
			? topUnitPrices.reduce((sum, p) => sum + p, 0) / topUnitPrices.length
			: 0;

	// 推定価格範囲：表示される類似物件の実際の価格の最小〜最大
	const estimatedMin = topPrices.length > 0 ? Math.min(...topPrices) : 0;
	const estimatedMax = topPrices.length > 0 ? Math.max(...topPrices) : 0;

	// 10. 対象物件の情報を計算（マイソクから取得したデータを使用）
	let targetProperty: TargetProperty | undefined;
	if (targetPropertyInput) {
		const currentYear = new Date().getFullYear();

		// 築年数を計算
		let buildingAge = "-";
		if (targetPropertyInput.constructionYear) {
			const yearMatch = targetPropertyInput.constructionYear.match(/(\d{4})/);
			if (yearMatch) {
				const constructionYear = Number(yearMatch[1]);
				if (constructionYear >= 1900 && constructionYear <= currentYear) {
					buildingAge = String(currentYear - constructionYear);
				}
			}
		}

		// 坪単価を計算
		let unitPrice = "-";
		if (targetPropertyInput.price && targetPropertyInput.area) {
			// 価格を数値に変換（万円単位）
			const priceNum =
				Number(targetPropertyInput.price.replace(/[^0-9]/g, "")) || 0;
			// 面積を数値に変換（㎡）
			const areaNum =
				Number(targetPropertyInput.area.replace(/[^0-9.]/g, "")) || 0;

			if (priceNum > 0 && areaNum > 0) {
				// 坪単価 = 価格（万円） ÷ （面積（㎡） × 0.3025）
				const tsubo = areaNum * 0.3025;
				const unitPriceNum = Math.round(priceNum / tsubo);
				unitPrice = unitPriceNum.toLocaleString();
			}
		}

		targetProperty = {
			name: targetPropertyInput.name || "対象物件",
			age: buildingAge,
			area: targetPropertyInput.area || "-",
			price: targetPropertyInput.price || "-",
			unitPrice: unitPrice,
		};
	}

	return {
		targetProperty,
		similarProperties: topTransactions.map(
			({ _unitPriceNum, _periodNum, transactionPeriod, ...rest }) => rest,
		),
		estimatedPriceMin: estimatedMin > 0 ? String(estimatedMin) : "-",
		estimatedPriceMax: estimatedMax > 0 ? String(estimatedMax) : "-",
		averageUnitPrice: Math.round(avgUnitPrice),
		dataCount: transactions.length,
	};
}

/**
 * 周辺取引価格ポイント取得スキーマ
 */
const pricePointsSchema = z.object({
	address: z.string().describe("物件の住所（例: '東京都港区六本木1-1-1'）"),
	zoom: z
		.number()
		.int()
		.min(11)
		.max(15)
		.optional()
		.default(14)
		.describe("検索範囲（11=広域〜15=詳細）。デフォルト14。"),
	yearsBack: z
		.number()
		.int()
		.min(1)
		.max(10)
		.optional()
		.default(5)
		.describe("過去何年分のデータを取得するか。デフォルト5年。"),
	maxResults: z
		.number()
		.int()
		.min(1)
		.max(10)
		.optional()
		.default(6)
		.describe("取得する最大件数。デフォルト6件。"),
	targetPropertyInput: z
		.object({
			name: z.string().optional().describe("物件名"),
			price: z.string().optional().describe("物件価格（例: '5,800万円'）"),
			area: z.string().optional().describe("専有面積（例: '72.5㎡'）"),
			constructionYear: z
				.string()
				.optional()
				.describe("築年または建築年（例: '2015年'）"),
		})
		.optional()
		.describe("対象物件の情報（マイソクから抽出）"),
});

type PricePointsParams = z.infer<typeof pricePointsSchema>;

/**
 * 周辺取引価格ポイント取得ツール
 * 中古マンションの取引事例を地図タイルベースで取得
 */
export const getPricePointsTool = tool({
	description:
		"物件住所から周辺の中古マンション取引事例を取得します。類似物件の価格分析に使用します。",
	inputSchema: pricePointsSchema,
	execute: async (params: PricePointsParams) => {
		return await fetchNearbyTransactions(params.address, {
			zoom: params.zoom,
			yearsBack: params.yearsBack,
			maxResults: params.maxResults,
			targetPropertyInput: params.targetPropertyInput,
		});
	},
});

/**
 * スライド6で使用するツール一覧
 */
export const reinfoTools = {
	get_price_info: getPriceInfoTool,
	get_municipalities: getMunicipalitiesTool,
	get_price_points: getPricePointsTool,
};
