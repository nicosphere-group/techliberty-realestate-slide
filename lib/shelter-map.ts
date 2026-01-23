import { Readable, Writable } from "node:stream";
import ky from "ky";
import * as PImage from "pureimage";
import { z } from "zod";
import { CSISGeocoder } from "@/lib/geocode";
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
	showHazardMap: z
		.boolean()
		.optional()
		.default(false)
		.describe("ハザードマップも表示するか。デフォルトはfalse。"),
	hazardTypes: z
		.array(
			z.enum([
				"flood_l2", // 洪水（想定最大規模）
				"high_tide", // 高潮
				"tsunami", // 津波
				"dosekiryu", // 土石流
				"kyukeisha", // 急傾斜地
				"jisuberi", // 地すべり
			]),
		)
		.optional()
		.default(["flood_l2"])
		.describe("表示するハザードマップの種類（showHazardMapがtrueの場合）"),
	hazardOpacity: z
		.number()
		.min(0)
		.max(1)
		.default(0.5)
		.describe("ハザードマップの不透明度"),
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

	// 各種タイルURLのベース
	private static readonly BASE_URLS = {
		std: "https://cyberjapandata.gsi.go.jp/xyz/std",
		pale: "https://cyberjapandata.gsi.go.jp/xyz/pale",
		hazard: "https://disaportaldata.gsi.go.jp/raster",
	};

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

		// 1. 中心座標の解決
		const centerCoords = await this.resolveCenter(opts.center);

		// 2. 画像サイズとズームレベルの決定
		const [width, height] = opts.size.split("x").map(Number);
		const scaledWidth = width * opts.scale;
		const scaledHeight = height * opts.scale;

		// ズームレベル（11-15の範囲、デフォルト15）
		const zoom = opts.zoom ?? 15;

		// 3. 必要なタイルの範囲を計算
		const centerPixel = this.latLonToPixel(
			centerCoords.lat,
			centerCoords.lon,
			zoom,
		);
		const topLeftPixel = {
			x: centerPixel.x - scaledWidth / 2,
			y: centerPixel.y - scaledHeight / 2,
		};

		// タイル座標の範囲
		const minX = Math.floor(topLeftPixel.x / 256);
		const maxX = Math.floor((topLeftPixel.x + scaledWidth) / 256);
		const minY = Math.floor(topLeftPixel.y / 256);
		const maxY = Math.floor((topLeftPixel.y + scaledHeight) / 256);

		// 4. キャンバス作成
		const canvas = PImage.make(scaledWidth, scaledHeight);
		const ctx = canvas.getContext("2d");

		// 背景を白で塗りつぶし
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, scaledWidth, scaledHeight);

		// 5. タイルを取得して描画
		const tilesToLoad: { x: number; y: number; z: number }[] = [];
		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				tilesToLoad.push({ x, y, z: zoom });
			}
		}

		// 避難所データを収集
		const allShelters: ShelterFeature[] = [];

		await Promise.all(
			tilesToLoad.map(async (tile) => {
				const destX = tile.x * 256 - topLeftPixel.x;
				const destY = tile.y * 256 - topLeftPixel.y;

				try {
					// ベース地図
					const baseTileUrl = `${ShelterMapGenerator.BASE_URLS.pale}/${tile.z}/${tile.x}/${tile.y}.png`;
					const baseImg = await this.fetchImage(baseTileUrl);
					if (baseImg) {
						ctx.drawImage(baseImg, destX, destY, 256, 256);
					}

					// ハザードマップ重ね合わせ（オプション）
					if (opts.showHazardMap) {
						ctx.globalAlpha = opts.hazardOpacity;
						for (const type of opts.hazardTypes) {
							const url = this.getHazardTileUrl(type, tile.x, tile.y, tile.z);
							const hazardImg = await this.fetchImage(url);
							if (hazardImg) {
								ctx.drawImage(hazardImg, destX, destY, 256, 256);
							}
						}
						ctx.globalAlpha = 1.0;
					}

					// 避難所データを取得
					const shelterData = await this.fetchShelterData(
						tile.x,
						tile.y,
						tile.z,
					);
					if (shelterData?.features) {
						allShelters.push(...shelterData.features);
					}
				} catch (e) {
					console.warn(`Failed to load tile ${tile.x}/${tile.y}/${tile.z}`, e);
				}
			}),
		);

		// 6. 避難所を距離順にソートして最寄りN個に絞り込む
		const sheltersWithDistance: ShelterWithDistance[] = allShelters.map(
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

		const nearestShelters = sheltersWithDistance
			.sort((a, b) => a.distance - b.distance)
			.slice(0, opts.maxShelters);

		// 7. 最寄り避難所のマーカーを番号付きで描画
		nearestShelters.forEach((shelter, index) => {
			const [lon, lat] = shelter.geometry.coordinates;
			const pixel = this.latLonToPixel(lat, lon, zoom);
			const x = pixel.x - topLeftPixel.x;
			const y = pixel.y - topLeftPixel.y;

			// 画像内に収まるかチェック
			if (x >= 0 && x <= scaledWidth && y >= 0 && y <= scaledHeight) {
				this.drawNumberedShelterMarker(ctx, x, y, index + 1);
			}
		});

		// 8. 中心点のマーカー描画
		this.drawCenterMarker(ctx, scaledWidth / 2, scaledHeight / 2);

		// 9. 出力
		let buffer: Buffer;
		switch (opts.format) {
			case "jpg": {
				const chunks: Buffer[] = [];
				const stream = new Writable({
					write(chunk, _encoding, done) {
						chunks.push(chunk);
						done();
					},
				});
				const promise = new Promise<void>((resolve) => {
					stream.on("finish", () => resolve());
				});
				await PImage.encodeJPEGToStream(canvas, stream);
				await promise;
				buffer = Buffer.concat(chunks);
				break;
			}
			case "png": {
				const chunks: Buffer[] = [];
				const stream = new Writable({
					write(chunk, _encoding, done) {
						chunks.push(chunk);
						done();
					},
				});
				const promise = new Promise<void>((resolve) => {
					stream.on("finish", () => resolve());
				});
				await PImage.encodePNGToStream(canvas, stream);
				await promise;
				buffer = Buffer.concat(chunks);
				break;
			}
			default:
				throw new Error(`Unsupported format: ${opts.format}`);
		}

		return buffer;
	}

	/**
	 * 避難所データのみを取得する（地図画像なし）
	 */
	async getShelters(center: string, zoom = 15): Promise<ShelterFeature[]> {
		const centerCoords = await this.resolveCenter(center);
		const centerPixel = this.latLonToPixel(
			centerCoords.lat,
			centerCoords.lon,
			zoom,
		);

		// 中心タイル + 周囲8タイルを取得
		const centerTileX = Math.floor(centerPixel.x / 256);
		const centerTileY = Math.floor(centerPixel.y / 256);

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

		// 重複を除去（座標が同じもの）
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
		const centerCoords = await this.resolveCenter(center);
		const shelters = await this.getShelters(center, zoom);

		// 中心座標からの距離を計算
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

		// 距離でソートして最寄りN箇所を取得
		return sheltersWithDistance
			.sort((a, b) => a.distance - b.distance)
			.slice(0, maxCount);
	}

	private async resolveCenter(
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

		// 住所とみなしてジオコーディング
		const results = await this.geocoder.geocode(center);
		if (results.length === 0) {
			throw new Error(`Address not found: ${center}`);
		}
		return {
			lat: results[0].coordinates.latitude,
			lon: results[0].coordinates.longitude,
		};
	}

	private latLonToPixel(lat: number, lon: number, zoom: number) {
		const n = 2 ** zoom;
		const x = Math.floor(((lon + 180) / 360) * n * 256);
		const latRad = (lat * Math.PI) / 180;
		const y = Math.floor(
			((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
				n *
				256,
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

	private getHazardTileUrl(
		type: string,
		x: number,
		y: number,
		z: number,
	): string {
		const b = ShelterMapGenerator.BASE_URLS.hazard;
		switch (type) {
			case "flood_l2":
				return `${b}/01_flood_l2_shinsuishin_data/${z}/${x}/${y}.png`;
			case "high_tide":
				return `${b}/03_hightide_l2_shinsuishin_data/${z}/${x}/${y}.png`;
			case "tsunami":
				return `${b}/04_tsunami_newlegend_data/${z}/${x}/${y}.png`;
			case "dosekiryu":
				return `${b}/05_dosekiryukeikaikuiki/${z}/${x}/${y}.png`;
			case "kyukeisha":
				return `${b}/05_kyukeishakeikaikuiki/${z}/${x}/${y}.png`;
			case "jisuberi":
				return `${b}/05_jisuberikeikaikuiki/${z}/${x}/${y}.png`;
			default:
				throw new Error(`Unknown hazard type: ${type}`);
		}
	}

	private async fetchImage(url: string): Promise<PImage.Bitmap | null> {
		const arrayBuffer = await ky(url)
			.arrayBuffer()
			.catch(() => null);

		if (!arrayBuffer) {
			return null;
		}

		const stream = new Readable();
		stream.push(Buffer.from(arrayBuffer));
		stream.push(null);

		return await PImage.decodePNGFromStream(stream);
	}

	private async fetchShelterData(
		x: number,
		y: number,
		z: number,
	): Promise<ShelterGeoJson | null> {
		try {
			const response = await this.reinfoClient.getShelters({ x, y, z });
			// APIはstatusフィールドなしで直接GeoJSONを返す
			return response as unknown as ShelterGeoJson;
		} catch (e) {
			console.warn(`Failed to fetch shelter data: z=${z}, x=${x}, y=${y}`, e);
			return null;
		}
	}

	/**
	 * フォントファイルに依存せず、塗りつぶしで綺麗な数字を描画する
	 */
	private drawVectorNumber(
		ctx: PImage.Context,
		x: number,
		y: number,
		num: number,
		size: number,
		color: string,
	) {
		ctx.fillStyle = color;

		const h = size * 0.5; // 文字の高さ
		const w = size * 0.35; // 文字の幅
		const lineWidth = h * 0.18; // 線の太さ

		// 簡易的に矩形を組み合わせて数字を描画
		const top = y - h / 2;
		const bottom = y + h / 2;
		const left = x - w / 2;
		const right = x + w / 2;
		const centerX = x;
		const centerY = y;

		switch (num) {
			case 1:
				// 縦棒
				ctx.fillRect(centerX - lineWidth / 2, top, lineWidth, h);
				break;
			case 2:
				// 上横
				ctx.fillRect(left, top, w, lineWidth);
				// 右上縦
				ctx.fillRect(right - lineWidth, top, lineWidth, h * 0.45);
				// 中横
				ctx.fillRect(left, centerY - lineWidth / 2, w, lineWidth);
				// 左下縦
				ctx.fillRect(left, centerY, lineWidth, h * 0.5);
				// 下横
				ctx.fillRect(left, bottom - lineWidth, w, lineWidth);
				break;
			case 3:
				// 上横
				ctx.fillRect(left, top, w, lineWidth);
				// 中横
				ctx.fillRect(left, centerY - lineWidth / 2, w, lineWidth);
				// 下横
				ctx.fillRect(left, bottom - lineWidth, w, lineWidth);
				// 右縦
				ctx.fillRect(right - lineWidth, top, lineWidth, h);
				break;
			case 4:
				// 左上縦
				ctx.fillRect(left, top, lineWidth, h * 0.6);
				// 中横
				ctx.fillRect(left, centerY, w, lineWidth);
				// 右縦
				ctx.fillRect(right - lineWidth, top, lineWidth, h);
				break;
			case 5:
				// 上横
				ctx.fillRect(left, top, w, lineWidth);
				// 左上縦
				ctx.fillRect(left, top, lineWidth, h * 0.45);
				// 中横
				ctx.fillRect(left, centerY - lineWidth / 2, w, lineWidth);
				// 右下縦
				ctx.fillRect(right - lineWidth, centerY, lineWidth, h * 0.5);
				// 下横
				ctx.fillRect(left, bottom - lineWidth, w, lineWidth);
				break;
			default:
				// フォールバック（丸）
				ctx.beginPath();
				ctx.arc(x, y, w / 2, 0, Math.PI * 2);
				ctx.fill();
				break;
		}
	}

	/**
	 * 番号付き避難所マーカーを描画（緑のピン + 番号）
	 */
	private drawNumberedShelterMarker(
		ctx: PImage.Context,
		x: number,
		y: number,
		number: number,
	) {
		const mainColor = "#22c55e"; // green-500
		const darkColor = "#15803d"; // green-700
		const radius = 16; // 円部分の半径（番号が入るように大きめ）
		const tipLength = 18; // 先端部分の長さ
		const centerY = y - tipLength - radius; // 円の中心Y座標

		// 影を描画
		ctx.globalAlpha = 0.3;
		ctx.fillStyle = "#000000";
		ctx.beginPath();
		ctx.arc(x + 3, y + 3, 8, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1.0;

		// ピン本体（涙滴型）を描画
		ctx.fillStyle = mainColor;

		// 上部の円
		ctx.beginPath();
		ctx.arc(x, centerY, radius, 0, Math.PI * 2);
		ctx.fill();

		// 下部の三角形（先端）
		ctx.beginPath();
		ctx.moveTo(x - radius * 0.7, centerY + radius * 0.7);
		ctx.lineTo(x, y);
		ctx.lineTo(x + radius * 0.7, centerY + radius * 0.7);
		ctx.closePath();
		ctx.fill();

		// 左側の暗い部分（立体感）
		ctx.fillStyle = darkColor;
		ctx.beginPath();
		ctx.arc(x, centerY, radius, Math.PI * 0.6, Math.PI * 1.4);
		ctx.lineTo(x, y);
		ctx.closePath();
		ctx.fill();

		// 内側の白い円（番号の背景）
		ctx.fillStyle = "#ffffff";
		ctx.beginPath();
		ctx.arc(x, centerY, radius * 0.6, 0, Math.PI * 2);
		ctx.fill();

		// 番号を描画（ベクター描画で見やすく）
		this.drawVectorNumber(ctx, x, centerY, number, radius * 0.9, mainColor);
	}

	private drawCenterMarker(ctx: PImage.Context, x: number, y: number) {
		// 中心点マーカー（赤色）
		this.drawPin(ctx, x, y, "#ef4444", "#b91c1c"); // red-500, red-700
	}

	/**
	 * ピン形状のマーカーを描画（Google Maps風）
	 * @param x ピンの先端のX座標
	 * @param y ピンの先端のY座標
	 */
	private drawPin(
		ctx: PImage.Context,
		x: number,
		y: number,
		fillColor: string,
		darkColor: string,
	) {
		const radius = 12; // 円部分の半径
		const tipLength = 14; // 先端部分の長さ
		const centerY = y - tipLength - radius; // 円の中心Y座標

		// 影を描画
		ctx.globalAlpha = 0.3;
		ctx.fillStyle = "#000000";
		ctx.beginPath();
		ctx.arc(x + 3, y + 3, 6, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1.0;

		// ピン本体（涙滴型）を描画
		ctx.fillStyle = fillColor;

		// 上部の円
		ctx.beginPath();
		ctx.arc(x, centerY, radius, 0, Math.PI * 2);
		ctx.fill();

		// 下部の三角形（先端）
		ctx.beginPath();
		ctx.moveTo(x - radius * 0.7, centerY + radius * 0.7);
		ctx.lineTo(x, y);
		ctx.lineTo(x + radius * 0.7, centerY + radius * 0.7);
		ctx.closePath();
		ctx.fill();

		// 左側の暗い部分（立体感）
		ctx.fillStyle = darkColor;
		ctx.beginPath();
		ctx.arc(x, centerY, radius, Math.PI * 0.6, Math.PI * 1.4);
		ctx.lineTo(x, y);
		ctx.closePath();
		ctx.fill();

		// 内側の白い円（ハイライト）
		ctx.fillStyle = "#ffffff";
		ctx.beginPath();
		ctx.arc(x, centerY, radius * 0.45, 0, Math.PI * 2);
		ctx.fill();

		// 光沢（小さな白い円）
		ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
		ctx.beginPath();
		ctx.arc(
			x - radius * 0.25,
			centerY - radius * 0.25,
			radius * 0.2,
			0,
			Math.PI * 2,
		);
		ctx.fill();
	}
}
