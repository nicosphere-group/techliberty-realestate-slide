import ky from "ky";
import { z } from "zod";
import { CSISGeocoder } from "@/lib/geocode";
import { buildStaticMapUrl } from "@/lib/google-maps-static-api";
import { ReinfoClient } from "@/lib/reinfo/client";

// バリデーション用スキーマ
export const shelterMapOptionsSchema = z.object({
	center: z
		.string()
		.describe(
			"地図の中心座標。カンマ区切りの緯度経度ペア（例: '35.6812,139.7671'）または住所文字列（例: '東京都千代田区千代田１−１'）。",
		),
	zoom: z
		.number()
		.int()
		.min(11)
		.max(15)
		.optional()
		.describe(
			"地図のズームレベル（11-15）。避難所APIはこの範囲のみ対応。デフォルトは15。",
		),
	size: z
		.string()
		.regex(/^\d+x\d+$/)
		.default("800x600")
		.describe("地図画像のサイズ。'{幅}x{高さ}'形式（例: '800x600'）。"),
	scale: z
		.number()
		.int()
		.min(1)
		.max(2)
		.optional()
		.default(1)
		.describe("返されるピクセル数の倍率。1または2を指定可能。デフォルトは1。"),
	format: z
		.enum(["png", "jpg"])
		.optional()
		.default("png")
		.describe("生成される画像の形式。デフォルトはpng。"),
	maxShelters: z
		.number()
		.int()
		.min(1)
		.max(10)
		.optional()
		.default(3)
		.describe("表示する最寄り避難所の最大数。デフォルトは3。"),
});

export type ShelterMapOptions = z.input<typeof shelterMapOptionsSchema>;

interface ShelterFeature {
	type: "Feature";
	geometry: {
		type: "Point";
		coordinates: [number, number]; // [lon, lat]
	};
	properties: Record<string, unknown>;
}

interface ShelterGeoJson {
	type: "FeatureCollection";
	features: ShelterFeature[];
}

export interface ShelterWithDistance extends ShelterFeature {
	distance: number; // メートル
	walkingMinutes: number; // 徒歩分数
}

export class ShelterMapGenerator {
	private geocoder: CSISGeocoder;
	private reinfoClient: ReinfoClient;

	constructor(reinfoApiKey?: string) {
		this.geocoder = new CSISGeocoder();
		const apiKey = reinfoApiKey ?? process.env.REINFO_API_KEY ?? "";
		this.reinfoClient = new ReinfoClient({ apiKey });
	}

	/**
	 * 避難所マップ画像を生成する
	 */
	async generate(options: ShelterMapOptions): Promise<Buffer> {
		const opts = shelterMapOptionsSchema.parse(options);

		const center = this.resolveCenter(opts.center);
		const size = opts.size;
		const zoom = opts.zoom ?? 15;
		const maxShelters = opts.maxShelters ?? 3;
		const shelters = await this.getNearestShelters(
			opts.center,
			zoom,
			maxShelters,
		);
		const markers = [
			{
				location: center,
				color: "red",
				label: "P",
			},
			...shelters.map((shelter, index) => {
				const [lon, lat] = shelter.geometry.coordinates;
				return {
					location: { lat, lng: lon },
					color: "green",
					label: String(index + 1),
				};
			}),
		];

		const url = buildStaticMapUrl({
			center,
			zoom,
			size,
			scale: opts.scale,
			format: opts.format,
			maptype: "roadmap",
			language: "ja",
			markers: markers.length > 0 ? markers : undefined,
			key: process.env.GOOGLE_MAPS_API_KEY,
		});

		const arrayBuffer = await ky.get(url).arrayBuffer();
		return Buffer.from(arrayBuffer);
	}

	/**
	 * 避難所データのみを取得する（地図画像なし）
	 */
	async getShelters(_center: string, _zoom = 15): Promise<ShelterFeature[]> {
		const centerCoords = await this.resolveCenterCoords(_center);
		const zoom = _zoom;
		const { x: centerTileX, y: centerTileY } = this.latLonToTile(
			centerCoords.lat,
			centerCoords.lon,
			zoom,
		);

		const tiles: { x: number; y: number; z: number }[] = [];
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				tiles.push({ x: centerTileX + dx, y: centerTileY + dy, z: zoom });
			}
		}

		const allShelters: ShelterFeature[] = [];
		await Promise.all(
			tiles.map(async (tile) => {
				const data = await this.fetchShelterData(tile.x, tile.y, tile.z);
				if (data?.features) {
					allShelters.push(...data.features);
				}
			}),
		);

		const uniqueShelters = allShelters.filter(
			(shelter, index, self) =>
				index ===
				self.findIndex(
					(s) =>
						s.geometry.coordinates[0] === shelter.geometry.coordinates[0] &&
						s.geometry.coordinates[1] === shelter.geometry.coordinates[1],
				),
		);

		return uniqueShelters;
	}

	/**
	 * 最寄りの避難所を取得（距離順）
	 */
	async getNearestShelters(
		center: string,
		zoom = 15,
		maxCount = 3,
	): Promise<ShelterWithDistance[]> {
		const centerCoords = await this.resolveCenterCoords(center);
		const shelters = await this.getShelters(center, zoom);

		const sheltersWithDistance: ShelterWithDistance[] = shelters.map(
			(shelter) => {
				const [lon, lat] = shelter.geometry.coordinates;
				const distance = this.calculateDistance(
					centerCoords.lat,
					centerCoords.lon,
					lat,
					lon,
				);
				const walkingMinutes = this.calculateWalkingMinutes(distance);
				return {
					...shelter,
					distance,
					walkingMinutes,
				};
			},
		);

		return sheltersWithDistance
			.sort((a, b) => a.distance - b.distance)
			.slice(0, maxCount);
	}

	private resolveCenter(center: string): string | { lat: number; lng: number } {
		// "lat,lon" 形式の場合
		if (center.includes(",")) {
			const [lat, lon] = center
				.split(",")
				.map((s) => Number.parseFloat(s.trim()));
			if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
				return { lat, lng: lon };
			}
		}

		return center;
	}

	private async resolveCenterCoords(
		center: string,
	): Promise<{ lat: number; lon: number }> {
		// "lat,lon" 形式の場合
		if (center.includes(",")) {
			const [lat, lon] = center
				.split(",")
				.map((s) => Number.parseFloat(s.trim()));
			if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
				return { lat, lon };
			}
		}

		const results = await this.geocoder.geocode(center);
		if (results.length === 0) {
			throw new Error(`Address not found: ${center}`);
		}
		return {
			lat: results[0].coordinates.latitude,
			lon: results[0].coordinates.longitude,
		};
	}

	private latLonToTile(lat: number, lon: number, zoom: number) {
		const n = 2 ** zoom;
		const x = Math.floor(((lon + 180) / 360) * n);
		const latRad = (lat * Math.PI) / 180;
		const y = Math.floor(
			((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
				n,
		);
		return { x, y };
	}

	/**
	 * 2点間の距離を計算（Haversine公式）
	 * @returns 距離（メートル）
	 */
	private calculateDistance(
		lat1: number,
		lon1: number,
		lat2: number,
		lon2: number,
	): number {
		const R = 6371e3; // 地球の半径（メートル）
		const φ1 = (lat1 * Math.PI) / 180;
		const φ2 = (lat2 * Math.PI) / 180;
		const Δφ = ((lat2 - lat1) * Math.PI) / 180;
		const Δλ = ((lon2 - lon1) * Math.PI) / 180;

		const a =
			Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
			Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return R * c;
	}

	/**
	 * 距離から徒歩時間を計算
	 * @param distanceMeters 距離（メートル）
	 * @returns 徒歩時間（分）、80m/分で計算
	 */
	private calculateWalkingMinutes(distanceMeters: number): number {
		const walkingSpeedMeterPerMinute = 80;
		return Math.ceil(distanceMeters / walkingSpeedMeterPerMinute);
	}

	private async fetchShelterData(
		x: number,
		y: number,
		z: number,
	): Promise<ShelterGeoJson | null> {
		try {
			const response = await this.reinfoClient.getShelters({ x, y, z });
			return response as unknown as ShelterGeoJson;
		} catch (e) {
			console.warn(`Failed to fetch shelter data: z=${z}, x=${x}, y=${y}`, e);
			return null;
		}
	}
}
