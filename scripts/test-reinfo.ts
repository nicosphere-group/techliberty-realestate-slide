import { ReinfoClient } from "../lib/reinfo";

const parseQuarter = (value?: string): 1 | 2 | 3 | 4 | undefined => {
	if (!value) {
		return undefined;
	}
	const quarter = Number(value);
	return quarter >= 1 && quarter <= 4 ? (quarter as 1 | 2 | 3 | 4) : undefined;
};

async function main() {
	const apiKey = process.env.REINFO_API_KEY;
	if (!apiKey) {
		console.error("REINFO_API_KEY が未設定です。環境変数に設定してください。");
		process.exit(1);
	}

	const area = process.argv[2] ?? "13";
	const year = Number(process.argv[3] ?? "2023");
	const quarter = parseQuarter(process.argv[4]);

	const client = new ReinfoClient({ apiKey });

	console.log("=== REINFO API Test ===");
	console.log(`area: ${area}, year: ${year}, quarter: ${quarter ?? "(none)"}`);

	try {
		const municipalities = await client.getMunicipalities({ area });
		console.log(`municipalities: ${municipalities.data.length}`);

		const priceInfo = await client.getPriceInfo({
			year,
			quarter,
			area,
		});
		console.log(`price info: ${priceInfo.data.length}`);
	} catch (error) {
		console.error("❌ REINFO API Error:", error);
		process.exit(1);
	}
}

main();
