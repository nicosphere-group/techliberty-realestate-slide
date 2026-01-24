import z from "zod";

export const boundingBoxSchema = z
	.object({
		objectName: z.string().describe("検出されたオブジェクトの名前"),
		y1: z
			.number()
			.describe(
				"バウンディングボックスの上端のY座標（画像の高さに対する割合）",
			),
		x1: z
			.number()
			.describe("バウンディングボックスの左端のX座標（画像の幅に対する割合）"),
		y2: z
			.number()
			.describe(
				"バウンディングボックスの下端のY座標（画像の高さに対する割合）",
			),
		x2: z
			.number()
			.describe("バウンディングボックスの右端のX座標（画像の幅に対する割合）"),
	})
	.describe("バウンディングボックスの情報");

export const boundingBoxesSchema = z
	.array(boundingBoxSchema)
	.describe("検出されたバウンディングボックスの配列");
