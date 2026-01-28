import z from "zod";
import { primaryInputSchema } from "@/lib/slide-generator/schemas";

export const formSchema = primaryInputSchema.extend({
	// 開発用オプション
	modelType: z
		.enum(["low", "middle", "high"])
		.optional()
		.describe("使用するモデル（開発用）"),
	useStructuredOutput: z
		.boolean()
		.optional()
		.describe("構造化出力を使用するか（開発用）"),
});
