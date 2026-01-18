import z from "zod";
import { primaryInputSchema } from "@/lib/slide-generator/schemas";

export const formSchema = primaryInputSchema.extend({
	// 開発用オプション
	modelType: z
		.enum(["low", "middle", "high"])
		.optional()
		.describe("使用するモデル（開発用）"),
	parallel: z
		.boolean()
		.optional()
		.describe("スライド生成を並列で行うか（開発用）"),
});
