"use server";

import { createStreamableValue } from "@ai-sdk/rsc";
import type z from "zod";
import { type Event, SlideGenerator } from "../lib/slide-generator";
import type { formSchema } from "./schemas";

export async function run(input: z.infer<typeof formSchema>) {
	const streamable = createStreamableValue<Event>();

	(async () => {
		try {
			const generator = new SlideGenerator({
				modelType: input.modelType,
				parallel: input.parallel,
			});
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
