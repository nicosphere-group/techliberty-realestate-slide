export type SearchParamValue =
	| string
	| number
	| boolean
	| Array<string | number>
	| undefined
	| null;

export const buildSearchParams = (
	input: Record<string, SearchParamValue>,
): URLSearchParams => {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(input)) {
		if (value === undefined || value === null) {
			continue;
		}
		if (Array.isArray(value)) {
			params.set(key, value.map(String).join(","));
			continue;
		}
		params.set(key, String(value));
	}
	return params;
};
