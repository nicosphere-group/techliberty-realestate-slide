import z from "zod";

export const boundingBoxSchema = z
	.object({
		box_2d: z
			.array(z.number())
			.length(4)
			.describe(
				"A list of integers representing the 2D coordinates of the bounding box, typically in the format [y_min, x_min, y_max, x_max].",
			),
		label: z
			.string()
			.describe(
				"A string representing the label or class associated with the object within the bounding box.",
			),
	})
	.describe(
		"Represents a bounding box with its 2D coordinates and associated label.",
	);
