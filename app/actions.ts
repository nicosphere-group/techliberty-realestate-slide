"use server";

import { createStreamableValue } from "@ai-sdk/rsc";
import {
	type Event,
	SlideGenerator,
	type SlideInput,
} from "../lib/slide-generator";

export async function run(formData: FormData) {
	const streamable = createStreamableValue<Event>();

	(async () => {
		try {
			const text = formData.get("text");
			const file = formData.get("image");

			let input: SlideInput | null = null;
			if (file instanceof File && file.size > 0) {
				const arrayBuffer = await file.arrayBuffer();
				input = {
					type: "image",
					data: Buffer.from(arrayBuffer),
					mimeType: file.type || "application/octet-stream",
				};
			} else if (typeof text === "string" && text.trim().length > 0) {
				input = { type: "text", content: text.trim() };
			}

			if (!input) {
				streamable.update({
					type: "error",
					message: "テキストまたは画像を入力してください。",
				});
				return;
			}

			const generator = new SlideGenerator();
			for await (const event of generator.run(input)) {
				streamable.update(event);
			}
		} catch (error) {
			streamable.update({
				type: "error",
				message: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			streamable.done();
		}
	})();

	return streamable.value;
}
