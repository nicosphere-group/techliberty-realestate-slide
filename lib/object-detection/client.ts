import { fal } from "@fal-ai/client";
import type { Sam3ImageInput } from "@fal-ai/client/endpoints";

export class ObjectDetection {
	async detectObjects(input: Sam3ImageInput) {
		const result = await fal.subscribe("fal-ai/sam-3/image", {
			input,
		});

		return result;
	}
}
