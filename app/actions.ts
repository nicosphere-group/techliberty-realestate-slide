"use server";

import { createStreamableValue } from "@ai-sdk/rsc";
import {
	type Event,
	type PrimaryInput,
	SlideGenerator,
} from "../lib/slide-generator";

export async function run(input: PrimaryInput) {
	const streamable = createStreamableValue<Event>();

	(async () => {
		try {
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
