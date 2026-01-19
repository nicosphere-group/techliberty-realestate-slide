import { type Event, SlideGenerator } from "@/lib/slide-generator";
import { formSchema } from "@/app/schemas";

/**
 * イベントをSSE形式にエンコード
 */
function encodeSSE(event: Event): string {
	const data = JSON.stringify(event);
	return `data: ${data}\n\n`;
}

/**
 * スライド生成API (Server-Sent Events)
 *
 * @ai-sdk/rsc の createStreamableValue を使わず、
 * 標準的なSSEストリーミングを使用することで安定性を向上
 */
export async function POST(request: Request) {
	try {
		// FormDataからファイルと入力データを取得
		const formData = await request.formData();

		// JSONデータをパース
		const inputJson = formData.get("input");
		if (!inputJson || typeof inputJson !== "string") {
			return new Response(JSON.stringify({ error: "Missing input data" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const rawInput = JSON.parse(inputJson);

		// ファイルを取得
		const flyerFile = formData.get("flyerFile");
		if (!flyerFile || !(flyerFile instanceof File)) {
			return new Response(JSON.stringify({ error: "Missing flyer file" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Zodでバリデーション
		const input = formSchema.parse({
			...rawInput,
			flyerFiles: [flyerFile],
		});

		// SSEストリームを作成
		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();

				try {
					const generator = new SlideGenerator({
						modelType: input.modelType,
						useStructuredOutput: input.useStructuredOutput,
					});

					for await (const event of generator.run(input)) {
						// イベントをSSE形式でエンコードして送信
						const sseData = encodeSSE(event);
						controller.enqueue(encoder.encode(sseData));

						// デバッグログ
						const eventInfo =
							event.type === "slide:end" ||
							event.type === "slide:generating" ||
							event.type === "slide:start"
								? `index=${(event as { index: number }).index}`
								: "";
						console.log(`[SSE] Event sent: ${event.type} ${eventInfo}`);
					}

					// ストリーム終了
					controller.close();
					console.log("[SSE] Stream closed");
				} catch (error) {
					console.error("[SSE] Generator error:", error);
					// エラーイベントを送信
					const errorEvent: Event = {
						type: "error",
						message: error instanceof Error ? error.message : "Unknown error",
					};
					controller.enqueue(encoder.encode(encodeSSE(errorEvent)));
					controller.close();
				}
			},
		});

		// SSEレスポンスを返す
		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("[SSE] Request error:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
