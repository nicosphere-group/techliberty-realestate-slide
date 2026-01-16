import { XMLParser } from "fast-xml-parser";
import ky, { type KyInstance } from "ky";
import { z } from "zod";

// APIレスポンスのスキーマ定義
const candidateSchema = z.object({
	address: z.string(),
	longitude: z.union([z.number(), z.string()]),
	latitude: z.union([z.number(), z.string()]),
	iLvl: z.union([z.number(), z.string()]).optional(),
});

const geocodingResponseSchema = z.object({
	results: z.object({
		query: z.string(),
		geodetic: z.string().optional(),
		iConf: z.union([z.number(), z.string()]).optional(),
		converted: z.string().optional(),
		candidate: z.union([candidateSchema, z.array(candidateSchema)]).optional(),
	}),
});

// 座標データ
export interface Coordinates {
	latitude: number;
	longitude: number;
}

// ジオコーディング結果
export interface GeocodingResult {
	address: string;
	coordinates: Coordinates;
}

// エラークラス
export class GeocodingError extends Error {
	constructor(
		message: string,
		public override cause?: unknown,
	) {
		super(message);
		this.name = "GeocodingError";
	}
}

/**
 * 東京大学CSIS (空間情報科学研究センター) のジオコーディングAPIを使用して住所から座標を取得する
 */
export class CSISGeocoder {
	private static readonly BASE_URL = "https://geocode.csis.u-tokyo.ac.jp";
	private static readonly REQUEST_TIMEOUT = 10000; // 10秒
	private readonly instance: KyInstance;
	private readonly parser: XMLParser;

	constructor() {
		this.instance = ky.create({
			prefixUrl: CSISGeocoder.BASE_URL,
			timeout: CSISGeocoder.REQUEST_TIMEOUT,
			headers: {
				"User-Agent": "Geocoder/1.0",
			},
		});
		this.parser = new XMLParser({
			ignoreAttributes: false,
			parseTagValue: true,
			trimValues: true,
		});
	}

	/**
	 * 住所文字列から座標を検索する
	 * @param address 検索する住所
	 * @returns ジオコーディング結果の配列
	 */
	async geocode(address: string): Promise<GeocodingResult[]> {
		const searchParams = new URLSearchParams({
			addr: address.trim(),
			charset: "UTF8",
		});

		const response = await this.instance.get("cgi-bin/simple_geocode.cgi", {
			searchParams,
		});

		const xmlText = await response.text();
		const data = this.parser.parse(xmlText);

		// レスポンスの検証
		const parsedData = geocodingResponseSchema.parse(data);

		// candidateが存在しない場合は空配列を返す
		if (!parsedData.results.candidate) {
			return [];
		}

		// candidateを配列に正規化
		const candidates = Array.isArray(parsedData.results.candidate)
			? parsedData.results.candidate
			: [parsedData.results.candidate];

		// 結果の変換
		return candidates.map((candidate) => {
			const longitude =
				typeof candidate.longitude === "string"
					? Number.parseFloat(candidate.longitude)
					: candidate.longitude;
			const latitude =
				typeof candidate.latitude === "string"
					? Number.parseFloat(candidate.latitude)
					: candidate.latitude;

			return {
				address: candidate.address,
				coordinates: {
					latitude,
					longitude,
				},
			};
		});
	}
}
