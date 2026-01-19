/**
 * 周辺施設・地図関連のツール定義
 * スライド5（周辺施設）で使用
 */
import { tool } from "ai";
import { PlacesClient } from "@googlemaps/places";
import ky from "ky";
import { z } from "zod";
import { uploadToS3 } from "./upload";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// 徒歩速度（メートル/分）- 不動産業界基準
const WALKING_SPEED = 80;

// 施設カテゴリ定義（色はGoogle Static Maps用の0x形式とHTML用の#形式を併記）
const FACILITY_CATEGORIES = [
	{
		type: "supermarket",
		label: "S",
		color: "0x7dabfd", // Google Static Maps用
		htmlColor: "#7dabfd", // HTML表示用
		name: "スーパー",
	},
	{
		type: "convenience_store",
		label: "C",
		color: "0x8aae02",
		htmlColor: "#8aae02",
		name: "コンビニ",
	},
	{
		type: "park",
		label: "K",
		color: "0xdc8501",
		htmlColor: "#dc8501",
		name: "公園",
	},
	{
		type: "hospital",
		label: "H",
		color: "0x926da6",
		htmlColor: "#926da6",
		name: "病院",
	},
];

/**
 * 2点間の距離を計算（ハーバーサイン公式）
 */
function calculateDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 6371e3;
	const p1 = (lat1 * Math.PI) / 180;
	const p2 = (lat2 * Math.PI) / 180;
	const dp = ((lat2 - lat1) * Math.PI) / 180;
	const dl = ((lng2 - lng1) * Math.PI) / 180;

	const a =
		Math.sin(dp / 2) * Math.sin(dp / 2) +
		Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

/**
 * Static Map URLスキーマ
 */
const staticMapSchema = z.object({
	center: z
		.string()
		.describe(
			"地図の中心座標。カンマ区切りの緯度経度ペア（例: '35.6812,139.7671'）または住所文字列。",
		),
	zoom: z
		.number()
		.int()
		.min(0)
		.max(21)
		.optional()
		.default(14)
		.describe("地図のズームレベル（0-21）。デフォルトは14。"),
	size: z
		.string()
		.regex(/^\d+x\d+$/)
		.optional()
		.default("640x480")
		.describe("地図画像のサイズ。'{幅}x{高さ}'形式。デフォルトは'640x480'。"),
	scale: z
		.number()
		.int()
		.min(1)
		.max(2)
		.optional()
		.default(1)
		.describe("返されるピクセル数の倍率。1または2を指定可能。デフォルトは1。"),
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
		.describe("地図タイル上のラベルの表示に使用する言語コード（例: 'ja'）。"),
	region: z
		.string()
		.length(2)
		.optional()
		.describe("地政学的機密性に基づいて表示する境界を定義する2文字のccTLDコード。"),
	markers: z
		.array(
			z.object({
				location: z
					.string()
					.describe("マーカーの位置。緯度経度または住所。"),
				color: z
					.string()
					.optional()
					.describe("マーカーの色。red, blue, green, purple等。"),
				label: z
					.string()
					.max(1)
					.optional()
					.describe("マーカーに表示する1文字のラベル（A-Z, 0-9）。"),
				size: z
					.enum(["tiny", "small", "mid"])
					.optional()
					.describe("マーカーのサイズ。"),
			}),
		)
		.optional()
		.describe("地図上に表示するマーカーの配列。"),
});

type StaticMapParams = z.infer<typeof staticMapSchema>;

/**
 * Google Static Maps画像URL生成ツール
 */
export const getStaticMapUrlTool = tool({
	description:
		"指定されたパラメータ（中心座標、ズーム、サイズ等）に基づいて、Google Maps Static APIの画像URLを取得します。周辺施設マップなどに使用します。",
	inputSchema: staticMapSchema,
	execute: async (params: StaticMapParams) => {
		const key = GOOGLE_MAPS_API_KEY;
		if (!key) {
			throw new Error("GOOGLE_MAPS_API_KEY is not set");
		}

		const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
		url.searchParams.append("center", params.center);
		url.searchParams.append("zoom", (params.zoom ?? 14).toString());
		url.searchParams.append("size", params.size ?? "640x480");
		url.searchParams.append("scale", (params.scale ?? 1).toString());
		url.searchParams.append("format", params.format ?? "png");
		url.searchParams.append("maptype", params.maptype ?? "roadmap");

		if (params.language) {
			url.searchParams.append("language", params.language);
		}
		if (params.region) {
			url.searchParams.append("region", params.region);
		}

		// マーカー追加
		if (params.markers && params.markers.length > 0) {
			for (const marker of params.markers) {
				const parts: string[] = [];
				if (marker.color) {
					parts.push(`color:${marker.color}`);
				}
				if (marker.size) {
					parts.push(`size:${marker.size}`);
				}
				if (marker.label) {
					parts.push(`label:${marker.label}`);
				}
				parts.push(marker.location);
				url.searchParams.append("markers", parts.join("|"));
			}
		}

		url.searchParams.append("key", key);

		// 画像を取得してS3にアップロード
		const buffer = await ky
			.get(url)
			.arrayBuffer()
			.then((arrayBuffer) => Buffer.from(arrayBuffer));

		const format = params.format ?? "png";
		const publicUrl = await uploadToS3(
			buffer,
			"static-maps",
			`image/${format}`,
		);

		return { url: publicUrl };
	},
});

/**
 * 周辺施設検索スキーマ
 */
const nearbyFacilitiesSchema = z.object({
	address: z.string().describe("検索中心の住所"),
	radiusMeters: z
		.number()
		.optional()
		.default(800)
		.describe("検索半径（メートル）。デフォルトは800m。"),
	maxResultsPerCategory: z
		.number()
		.optional()
		.default(3)
		.describe("カテゴリごとの最大取得件数。デフォルトは3件。"),
});

type NearbyFacilitiesParams = z.infer<typeof nearbyFacilitiesSchema>;

interface Facility {
	name: string;
	category: string;
	categoryLabel: string;
	color: string; // Google Static Maps用（0x形式）
	htmlColor: string; // HTML表示用（#形式）
	lat: number;
	lng: number;
	distanceMeters: number;
	walkMinutes: number;
}

/**
 * 周辺施設検索ツール
 * Google Places APIを使用
 */
export const searchNearbyFacilitiesTool = tool({
	description:
		"指定住所の周辺施設（スーパー、コンビニ、公園、病院）を検索します。各施設の名前、カテゴリ、距離、徒歩時間を返します。",
	inputSchema: nearbyFacilitiesSchema,
	execute: async (params: NearbyFacilitiesParams) => {
		if (!GOOGLE_MAPS_API_KEY) {
			throw new Error("GOOGLE_MAPS_API_KEY is not set");
		}

		const placesClient = new PlacesClient({ apiKey: GOOGLE_MAPS_API_KEY });

		// 1. 住所から座標を取得
		const [geoResponse] = await placesClient.searchText(
			{
				textQuery: params.address,
				languageCode: "ja",
			},
			{
				otherArgs: {
					headers: {
						"X-Goog-FieldMask": "places.location,places.formattedAddress",
					},
				},
			},
		);

		const place = geoResponse.places?.[0];
		if (!place?.location?.latitude || !place?.location?.longitude) {
			throw new Error(`住所が見つかりませんでした: ${params.address}`);
		}

		const centerLat = place.location.latitude;
		const centerLng = place.location.longitude;

		// 2. 各カテゴリで周辺施設を検索
		const facilities: Facility[] = [];

		for (const category of FACILITY_CATEGORIES) {
			try {
				const [response] = await placesClient.searchNearby(
					{
						includedTypes: [category.type],
						maxResultCount: params.maxResultsPerCategory ?? 3,
						locationRestriction: {
							circle: {
								center: { latitude: centerLat, longitude: centerLng },
								radius: params.radiusMeters ?? 800,
							},
						},
						languageCode: "ja",
					},
					{
						otherArgs: {
							headers: {
								"X-Goog-FieldMask": "places.displayName,places.location",
							},
						},
					},
				);

				if (response.places) {
					for (const p of response.places) {
						if (p.location?.latitude && p.location?.longitude) {
							const dist = calculateDistance(
								centerLat,
								centerLng,
								p.location.latitude,
								p.location.longitude,
							);
							facilities.push({
								name: p.displayName?.text || "不明",
								category: category.name,
								categoryLabel: category.label,
								color: category.color,
								htmlColor: category.htmlColor,
								lat: p.location.latitude,
								lng: p.location.longitude,
								distanceMeters: Math.round(dist),
								walkMinutes: Math.ceil(dist / WALKING_SPEED),
							});
						}
					}
				}
			} catch (e) {
				console.warn(`${category.name} の検索でエラー:`, e);
			}
		}

		return {
			facilities,
			centerLat,
			centerLng,
			address: place.formattedAddress || params.address,
		};
	},
});

/**
 * 周辺施設マップ生成スキーマ（統合ツール）
 */
const nearbyMapSchema = z.object({
	address: z.string().describe("検索中心の住所"),
	radiusMeters: z
		.number()
		.optional()
		.default(800)
		.describe("検索半径（メートル）。デフォルトは800m。"),
	maxResultsPerCategory: z
		.number()
		.optional()
		.default(3)
		.describe("カテゴリごとの最大取得件数。デフォルトは3件。"),
});

type NearbyMapParams = z.infer<typeof nearbyMapSchema>;

/**
 * 周辺施設マップ生成ツール（統合版）
 * 施設検索 + マーカー付き地図生成を一括で行う
 */
export const generateNearbyMapTool = tool({
	description:
		"指定住所の周辺施設を検索し、施設をマーカーでマッピングした地図画像を生成します。施設情報と地図画像URLを返します。",
	inputSchema: nearbyMapSchema,
	execute: async (params: NearbyMapParams) => {
		if (!GOOGLE_MAPS_API_KEY) {
			throw new Error("GOOGLE_MAPS_API_KEY is not set");
		}

		const placesClient = new PlacesClient({ apiKey: GOOGLE_MAPS_API_KEY });

		// 1. 住所から座標を取得
		const [geoResponse] = await placesClient.searchText(
			{
				textQuery: params.address,
				languageCode: "ja",
			},
			{
				otherArgs: {
					headers: {
						"X-Goog-FieldMask": "places.location,places.formattedAddress",
					},
				},
			},
		);

		const place = geoResponse.places?.[0];
		if (!place?.location?.latitude || !place?.location?.longitude) {
			throw new Error(`住所が見つかりませんでした: ${params.address}`);
		}

		const centerLat = place.location.latitude;
		const centerLng = place.location.longitude;

		// 2. 各カテゴリで周辺施設を検索
		const facilities: Facility[] = [];

		for (const category of FACILITY_CATEGORIES) {
			try {
				const [response] = await placesClient.searchNearby(
					{
						includedTypes: [category.type],
						maxResultCount: params.maxResultsPerCategory ?? 3,
						locationRestriction: {
							circle: {
								center: { latitude: centerLat, longitude: centerLng },
								radius: params.radiusMeters ?? 800,
							},
						},
						languageCode: "ja",
					},
					{
						otherArgs: {
							headers: {
								"X-Goog-FieldMask": "places.displayName,places.location",
							},
						},
					},
				);

				if (response.places) {
					for (const p of response.places) {
						if (p.location?.latitude && p.location?.longitude) {
							const dist = calculateDistance(
								centerLat,
								centerLng,
								p.location.latitude,
								p.location.longitude,
							);
							facilities.push({
								name: p.displayName?.text || "不明",
								category: category.name,
								categoryLabel: category.label,
								color: category.color,
								htmlColor: category.htmlColor,
								lat: p.location.latitude,
								lng: p.location.longitude,
								distanceMeters: Math.round(dist),
								walkMinutes: Math.ceil(dist / WALKING_SPEED),
							});
						}
					}
				}
			} catch (e) {
				console.warn(`${category.name} の検索でエラー:`, e);
			}
		}

		// 3. カテゴリごとに距離順ソート＆連番を付与（各カテゴリ内で1, 2, 3...）
		const categoryCounters: Record<string, number> = {};
		const numberedFacilities = facilities
			.sort((a, b) => a.distanceMeters - b.distanceMeters)
			.map((facility) => {
				// カテゴリごとにカウンターを管理
				if (!categoryCounters[facility.category]) {
					categoryCounters[facility.category] = 0;
				}
				categoryCounters[facility.category]++;
				return {
					...facility,
					number: categoryCounters[facility.category],
				};
			});

		// 4. マーカー付き地図を生成
		const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
		url.searchParams.append("center", `${centerLat},${centerLng}`);
		url.searchParams.append("zoom", "15");
		url.searchParams.append("size", "800x600");
		url.searchParams.append("scale", "2");
		url.searchParams.append("format", "png");
		url.searchParams.append("maptype", "roadmap");
		url.searchParams.append("language", "ja");

		// 物件位置のマーカー（赤）
		url.searchParams.append(
			"markers",
			`color:red|label:P|${centerLat},${centerLng}`,
		);

		// 施設マーカーを追加（連番ラベル）
		for (const facility of numberedFacilities) {
			// Google Static Mapsのラベルは1-9, A-Zが使用可能
			const label =
				facility.number <= 9
					? String(facility.number)
					: String.fromCharCode(65 + facility.number - 10); // 10以上はA, B, C...
			url.searchParams.append(
				"markers",
				`color:${facility.color}|label:${label}|${facility.lat},${facility.lng}`,
			);
		}

		url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

		// 画像を取得してS3にアップロード
		const buffer = await ky
			.get(url)
			.arrayBuffer()
			.then((arrayBuffer) => Buffer.from(arrayBuffer));

		const mapImageUrl = await uploadToS3(buffer, "nearby-maps", "image/png");

		return {
			facilities: numberedFacilities,
			centerLat,
			centerLng,
			address: place.formattedAddress || params.address,
			mapImageUrl,
		};
	},
});

/**
 * スライド5で使用するツール一覧
 */
export const nearbyTools = {
	generate_nearby_map: generateNearbyMapTool,
};
