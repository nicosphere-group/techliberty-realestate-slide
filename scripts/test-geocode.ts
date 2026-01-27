/**
 * ジオコーディングのテスト
 */
import "dotenv/config";

const testAddress = "横浜市鶴見区馬場六丁目717番40号";

async function geocodeWithGoogle(
	address: string,
): Promise<{ lat: number; lng: number } | null> {
	const apiKey = process.env.GOOGLE_MAPS_API_KEY;
	const keyInfo = apiKey ? `設定あり (${apiKey.slice(0, 10)}...)` : "未設定";
	console.log("[Test] GOOGLE_MAPS_API_KEY:", keyInfo);

	if (!apiKey) {
		return null;
	}

	try {
		const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
		url.searchParams.set("address", address);
		url.searchParams.set("key", apiKey);
		url.searchParams.set("language", "ja");

		console.log(
			"[Test] Google API URL:",
			url.toString().replace(apiKey, "***"),
		);

		const response = await fetch(url.toString());
		const data = await response.json();

		console.log("[Test] Google API response status:", data.status);
		console.log("[Test] Google API response:", JSON.stringify(data, null, 2));

		if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
			const { lat, lng } = data.results[0].geometry.location;
			return { lat, lng };
		}

		return null;
	} catch (error) {
		console.error("[Test] Google geocoding error:", error);
		return null;
	}
}

async function geocodeWithNominatim(
	address: string,
): Promise<{ lat: number; lng: number } | null> {
	try {
		const url = new URL("https://nominatim.openstreetmap.org/search");
		url.searchParams.set("q", address);
		url.searchParams.set("format", "json");
		url.searchParams.set("limit", "1");
		url.searchParams.set("countrycodes", "jp");

		console.log("[Test] Nominatim URL:", url.toString());

		const response = await fetch(url.toString(), {
			headers: {
				"User-Agent": "TechLiberty-RealEstate-Slide/1.0",
			},
		});
		const data = await response.json();

		console.log("[Test] Nominatim response:", JSON.stringify(data, null, 2));

		if (data && data.length > 0 && data[0].lat && data[0].lon) {
			const lat = parseFloat(data[0].lat);
			const lng = parseFloat(data[0].lon);
			return { lat, lng };
		}

		return null;
	} catch (error) {
		console.error("[Test] Nominatim geocoding error:", error);
		return null;
	}
}

async function main() {
	console.log("=== ジオコーディングテスト ===");
	console.log("テスト住所:", testAddress);
	console.log("");

	// Google Maps API
	console.log("--- Google Maps Geocoding API ---");
	const googleResult = await geocodeWithGoogle(testAddress);
	console.log("Google結果:", googleResult);
	console.log("");

	// Nominatim
	console.log("--- Nominatim (OpenStreetMap) ---");
	const nominatimResult = await geocodeWithNominatim(testAddress);
	console.log("Nominatim結果:", nominatimResult);
	console.log("");

	// 簡略化した住所でも試す
	const simplifiedAddresses = [
		"神奈川県横浜市鶴見区馬場六丁目",
		"横浜市鶴見区馬場",
		"鶴見区馬場",
	];

	console.log("--- 簡略化した住所でのテスト ---");
	for (const addr of simplifiedAddresses) {
		console.log("\n住所:", addr);
		const result = await geocodeWithNominatim(addr);
		console.log("結果:", result);
	}
}

main().catch(console.error);
