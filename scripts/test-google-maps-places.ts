import { PlacesClient } from "@googlemaps/places";

// 検索の中心となる住所
const TARGET_ADDRESS = "東京都千代田区丸の内1-9-1"; // 東京駅

// 検索設定
const SEARCH_RADIUS_METERS = 1000; // 半径1km
const WALKING_SPEED_METERS_PER_MIN = 80; // 不動産業界基準: 80m/分

// 検索する施設タイプ
// Google Maps Platform の Place Types を参照
// https://developers.google.com/maps/documentation/places/web-service/supported_types
const CATEGORIES = [
	{ type: "supermarket", label: "スーパー" },
	{ type: "convenience_store", label: "コンビニ" },
	{ type: "park", label: "公園" },
	{ type: "hospital", label: "病院" },
];

// ハーバーサインの公式で2点間の直線距離(メートル)を計算
function calculateDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 6371e3; // 地球の半径 (メートル)
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lng2 - lng1) * Math.PI) / 180;

	const a =
		Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

async function main() {
	const client = new PlacesClient({
		apiKey: process.env.GOOGLE_MAPS_API_KEY,
	});

	console.log(`Target Address: "${TARGET_ADDRESS}"`);

	// 1. まず住所から緯度経度を取得 (searchTextを使用)
	let centerLat: number;
	let centerLng: number;

	try {
		const [geoResponse] = await client.searchText(
			{
				textQuery: TARGET_ADDRESS,
				languageCode: "ja",
			},
			{
				otherArgs: {
					headers: {
						"X-Goog-FieldMask": "places.location,places.formattedAddress",
					},
				},
			},
		);

		if (
			!geoResponse.places ||
			geoResponse.places.length === 0 ||
			!geoResponse.places[0].location
		) {
			console.error("住所の場所が見つかりませんでした。");
			return;
		}

		const location = geoResponse.places[0].location;
		if (!location.latitude || !location.longitude) {
			console.error("住所の緯度経度情報が不完全です。");
			return;
		}
		centerLat = location.latitude;
		centerLng = location.longitude;
		console.log(
			`Location found: ${geoResponse.places[0].formattedAddress} (${centerLat}, ${centerLng})`,
		);
		console.log("--------------------------------------------------");
	} catch (err) {
		console.error("住所検索に失敗しました:", err);
		return;
	}

	// 2. 各カテゴリについて周辺検索 (searchNearbyを使用)
	for (const category of CATEGORIES) {
		console.log(`\nSearching for ${category.label} (${category.type})...`);

		try {
			const request = {
				includedTypes: [category.type],
				maxResultCount: 5, // 各カテゴリ上位5件
				locationRestriction: {
					circle: {
						center: {
							latitude: centerLat,
							longitude: centerLng,
						},
						radius: SEARCH_RADIUS_METERS,
					},
				},
				languageCode: "ja", // 日本語化
			};

			const [response] = await client.searchNearby(request, {
				otherArgs: {
					headers: {
						// locationも含めて距離計算に使用
						"X-Goog-FieldMask":
							"places.displayName,places.formattedAddress,places.location,places.rating",
					},
				},
			});

			if (!response.places || response.places.length === 0) {
				console.log(`  周辺に ${category.label} は見つかりませんでした。`);
				continue;
			}

			for (const place of response.places) {
				const name = place.displayName?.text || "名称不明";
				const address = place.formattedAddress || "住所不明";

				let distanceInfo = "";
				if (place.location?.latitude && place.location?.longitude) {
					// 直線距離を計算
					const distMeters = calculateDistance(
						centerLat,
						centerLng,
						place.location.latitude,
						place.location.longitude,
					);
					// 徒歩所要時間 (切り上げ)
					const walkMinutes = Math.ceil(
						distMeters / WALKING_SPEED_METERS_PER_MIN,
					);
					distanceInfo = `約${Math.round(distMeters)}m (徒歩約${walkMinutes}分)`;
				}

				console.log(`  - ${name}`);
				console.log(`    ${address}`);
				console.log(`    ${distanceInfo}`);
			}
		} catch (err) {
			console.error(`  ${category.label} の検索中にエラーが発生しました:`, err);
		}
	}
}

main();
