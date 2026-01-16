import { RoutesClient } from "@googlemaps/routing";

async function main() {
	// クライアントの初期化
	const client = new RoutesClient({
		apiKey: process.env.GOOGLE_MAPS_API_KEY,
	});

	// 東京タワーからスカイツリーへのルート
	const origin = {
		location: {
			latLng: {
				latitude: 35.658581, // 東京タワー
				longitude: 139.745433,
			},
		},
	};

	const destination = {
		location: {
			latLng: {
				latitude: 35.710063, // 東京スカイツリー
				longitude: 139.8107,
			},
		},
	};

	console.log("Computing route from Tokyo Tower to Skytree...");

	const request = {
		origin,
		destination,
		travelMode: "DRIVE" as const,
		routingPreference: "TRAFFIC_AWARE" as const,
		computeAlternativeRoutes: false,
		routeModifiers: {
			avoidTolls: false,
			avoidHighways: false,
			avoidFerries: false,
		},
		languageCode: "ja-JP",
		units: "METRIC" as const,
	};

	try {
		const [response] = await client.computeRoutes(request, {
			otherArgs: {
				headers: {
					"X-Goog-FieldMask":
						"routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
				},
			},
		});

		console.log("--- Results ---");

		if (!response.routes || response.routes.length === 0) {
			console.log("No routes found.");
			return;
		}

		for (const [index, route] of response.routes.entries()) {
			console.log(`Route ${index + 1}:`);
			console.log(`- Distance: ${route.distanceMeters} meters`);
			// durationは "123s" のような文字列、またはオブジェクトで返ってくる場合があります
			const durationSeconds = route.duration?.seconds;
			console.log(`- Duration: ${durationSeconds}s`);

			if (route.description) {
				console.log(`- Description: ${route.description}`);
			}

			// ポリライン（地図描画用）
			if (route.polyline?.encodedPolyline) {
				console.log(
					`- Encoded Polyline (truncated): ${route.polyline.encodedPolyline.substring(0, 30)}...`,
				);
			}

			console.log("");
		}
	} catch (err) {
		console.error("Error calling Routing API:", err);
	}
}

main();
