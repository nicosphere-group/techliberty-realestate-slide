import { fal } from "@fal-ai/client";
import type { ObjectDetectionInput, ObjectDetectionOutput } from "./types";

export class ObjectDetection {
	async detectObjects(
		input: ObjectDetectionInput,
	): Promise<ObjectDetectionOutput> {
		const result = await fal.subscribe("fal-ai/sam-3/image", {
			input,
		});

		return result.data;
	}
}
