import { Hono } from "hono";
import { formSchema } from "@/app/(authenticated)/schemas";
import { SlideGenerator } from "@/lib/slide-generator";
import { streamSSE } from "hono/streaming";
import { validator } from "hono/validator";
import { auth } from "@/lib/auth";
import { HTTPException } from "hono/http-exception";

const app = new Hono<{
	Variables: {
		user: typeof auth.$Infer.Session.user;
		session: typeof auth.$Infer.Session.session;
	};
}>();

app.use("*", async (c, next) => {
	const session = await auth.api.getSession({
		headers: c.req.raw.headers,
	});
	if (!session) {
		throw new HTTPException(401);
	}
	c.set("user", session.user);
	c.set("session", session.session);
	return next();
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

export default app;
