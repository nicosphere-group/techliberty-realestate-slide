import { Readable, Writable } from "node:stream";
import ky from "ky";
import * as PImage from "pureimage";
import { z } from "zod";
import { CSISGeocoder } from "@/lib/geocode";

// バリデーション用スキーマ（ユーザー要望に基づく）
export const hazardMapOptionsSchema = z.object({
	center: z
		.string()
		.describe(
			"地図の中心座標。カンマ区切りの緯度経度ペア（例: '40.714728,-73.998672'）または住所文字列（例: 'city hall, new york, ny'）。マーカーが存在しない場合は必須。",
		),
	zoom: z
		.number()
		.int()
		.min(0)
		.max(21)
		.optional()
		.describe(
			"地図のズームレベル（0-21）。指定がない場合は半径5km程度が表示されるように自動調整されます。",
		),
	size: z
		.string()
		.regex(/^\d+x\d+$/)
		.default("640x640")
		.describe("地図画像のサイズ。'{幅}x{高さ}'形式（例: '500x400'）。必須。"),
	scale: z
		.number()
		.int()
		.min(1)
		.max(2)
		.optional()
		.default(1)
		.describe("返されるピクセル数の倍率。1または2を指定可能。デフォルトは1。"),
	format: z
		.enum(["png", "jpg"]) // canvasでのサポートに合わせて簡易化
		.optional()
		.default("png")
		.describe("生成される画像の形式。デフォルトはpng。"),
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
		.default(["flood_l2", "dosekiryu", "kyukeisha", "jisuberi"])
		.describe("表示するハザードマップの種類"),
	opacity: z
		.number()
		.min(0)
		.max(1)
		.default(0.7)
		.describe("ハザードマップの不透明度"),
});

export type HazardMapOptions = z.input<typeof hazardMapOptionsSchema>;

export class HazardMapGenerator {
	private geocoder: CSISGeocoder;

	// 各種タイルURLのベース
	private static readonly BASE_URLS = {
		std: "https://cyberjapandata.gsi.go.jp/xyz/std",
		pale: "https://cyberjapandata.gsi.go.jp/xyz/pale",
		hazard: "https://disaportaldata.gsi.go.jp/raster",
	};

	constructor() {
		this.geocoder = new CSISGeocoder();
	}

	/**
	 * ハザードマップ画像を生成する
	 */
	async generate(options: HazardMapOptions): Promise<Buffer> {
		const opts = hazardMapOptionsSchema.parse(options);

		// 1. 中心座標の解決
		const centerCoords = await this.resolveCenter(opts.center);

		// 2. 画像サイズとズームレベルの決定
		const [width, height] = opts.size.split("x").map(Number);
		const scaledWidth = width * opts.scale;
		const scaledHeight = height * opts.scale;

		// ズームレベルが未指定の場合、半径2.5km程度が入るように調整 (Zoom 14)
		// Zoom 14: 1px ≒ 9.75m (赤道付近)
		// 日本付近(北緯35度)だと 1px ≒ 9.75 * cos(35deg) ≒ 8m -> 640px ≒ 5km (半径2.5km)
		const zoom = opts.zoom ?? 14;

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

		await Promise.all(
			tilesToLoad.map(async (tile) => {
				const destX = tile.x * 256 - topLeftPixel.x;
				const destY = tile.y * 256 - topLeftPixel.y;

				try {
					// ベース地図 (標準地図を使用)
					const baseTileUrl = `${HazardMapGenerator.BASE_URLS.std}/${tile.z}/${tile.x}/${tile.y}.png`;
					const baseImg = await this.fetchImage(baseTileUrl);
					if (baseImg) {
						ctx.drawImage(baseImg, destX, destY, 256, 256);
					}

					// ハザードマップ重ね合わせ
					ctx.globalAlpha = opts.opacity;
					for (const type of opts.hazardTypes) {
						const url = this.getHazardTileUrl(type, tile.x, tile.y, tile.z);
						const hazardImg = await this.fetchImage(url);
						if (hazardImg) {
							ctx.drawImage(hazardImg, destX, destY, 256, 256);
						}
					}
					ctx.globalAlpha = 1.0;
				} catch (e) {
					// タイル読み込みエラーは無視して続行（一部欠けるだけ）
					console.warn(`Failed to load tile ${tile.x}/${tile.y}/${tile.z}`, e);
				}
			}),
		);

		// 6. 中心点のマーカー描画（オプション）
		// 不要なら削除可能だが、地点確認のためにあると便利
		this.drawMarker(ctx, scaledWidth / 2, scaledHeight / 2);

		// 7. 出力
		// const buffer =
		// 	opts.format === "jpg"
		// 		? canvas.toBuffer("image/jpeg")
		// 		: canvas.toBuffer("image/png");
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

	private getHazardTileUrl(
		type: string,
		x: number,
		y: number,
		z: number,
	): string {
		const b = HazardMapGenerator.BASE_URLS.hazard;
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

	private drawMarker(ctx: PImage.Context, x: number, y: number) {
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
		ctx.arc(x - radius * 0.25, centerY - radius * 0.25, radius * 0.2, 0, Math.PI * 2);
		ctx.fill();
	}
}
