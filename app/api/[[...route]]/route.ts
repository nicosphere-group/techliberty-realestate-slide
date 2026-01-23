import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { validator } from "hono/validator";
import { handle } from "hono/vercel";
import { formSchema } from "@/app/schemas";
import { SlideGenerator } from "@/lib/slide-generator";

const app = new Hono().basePath("/api");

let id = 0;

app.get("/sse", async (c) => {
	return streamSSE(c, async (stream) => {
		while (true) {
			const message = `It is ${new Date().toISOString()}`;
			await stream.writeSSE({
				data: message,
				event: "time-update",
				id: String(id++),
			});
			await stream.sleep(1000);
		}
	});
});

app.post(
	"/generate",
	validator("form", (value) => {
		try {
			if (typeof value.input !== "string") {
				throw new Error("Invalid input");
			}
			const inputData = JSON.parse(value.input);
			const flyerFiles: File[] = [];
			for (const file of Array.isArray(value.flyerFiles)
				? value.flyerFiles
				: [value.flyerFiles]) {
				if (file instanceof File) {
					flyerFiles.push(file);
				}
			}
			const result = formSchema.parse({
				...inputData,
				flyerFiles,
			});
			return result;
		} catch (e) {
			console.error(e);
			throw new Error("Invalid form data");
		}
	}),
	(c) => {
		const validated = c.req.valid("form");

		return streamSSE(c, async (stream) => {
			let aborted = false;
			stream.onAbort(() => {
				aborted = true;
			});

			const heartbeatInterval = setInterval(() => {
				stream.writeSSE({
					id: Date.now().toString(),
					event: "heartbeat",
					data: JSON.stringify({
						timestamp: Date.now(),
					}),
				});
			}, 15000);

			const generator = new SlideGenerator({
				modelType: validated.modelType,
				useStructuredOutput: validated.useStructuredOutput,
			});

			for await (const event of generator.run(validated)) {
				if (aborted) {
					console.log("[SSE] Stream aborted by client");
					break;
				}

				await stream.writeSSE({
					id: Date.now().toString(),
					event: event.type,
					data: JSON.stringify(event.data ?? {}),
				});

				// デバッグログ
				const eventInfo =
					event.type === "slide:end" ||
					event.type === "slide:generating" ||
					event.type === "slide:start"
						? `index=${event.data.index}`
						: "";
				console.log(`[SSE] Event sent: ${event.type} ${eventInfo}`);
			}

			clearInterval(heartbeatInterval);

			// ストリーム終了
			console.log("[SSE] Stream closed");
		});
	},
);

// https://nextjs.org/docs/app/api-reference/file-conventions/route#reference
export const GET = handle(app);
export const HEAD = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
