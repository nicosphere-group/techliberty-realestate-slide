/**
 * 周辺施設マップ生成テストスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/test-nearby-map.ts [住所]
 *
 * 例:
 *   npx tsx scripts/test-nearby-map.ts "東京都千代田区丸の内1-9-1"
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PlacesClient } from "@googlemaps/places";

// .env ファイルを読み込む
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
	const envContent = readFileSync(envPath, "utf-8");
	for (const line of envContent.split("\n")) {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith("#")) {
			const [key, ...valueParts] = trimmed.split("=");
			const value = valueParts.join("=").replace(/^["']|["']$/g, "");
			if (key && !process.env[key]) {
				process.env[key] = value;
			}
		}
	}
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Google Maps アイコンURL
const GMAP_ICONS = "https://maps.google.com/mapfiles/ms/icons";

// 検索する施設カテゴリ
const FACILITY_CATEGORIES = [
	{ type: "supermarket", label: "S", color: "blue", name: "スーパー", icon: `${GMAP_ICONS}/shopping.png` },
	{ type: "convenience_store", label: "C", color: "green", name: "コンビニ", icon: `${GMAP_ICONS}/convenience.png` },
	{ type: "park", label: "K", color: "orange", name: "公園", icon: `${GMAP_ICONS}/tree.png` },
	{ type: "hospital", label: "H", color: "purple", name: "病院", icon: `${GMAP_ICONS}/hospitals.png` },
];

// 検索半径（メートル）
const SEARCH_RADIUS = 800;

// 徒歩速度（メートル/分）- 不動産業界基準
const WALKING_SPEED = 80;

interface Facility {
	name: string;
	category: string;
	categoryLabel: string;
	color: string;
	icon?: string;
	lat: number;
	lng: number;
	distanceMeters: number;
	walkMinutes: number;
}

// 2点間の距離を計算（ハーバーサイン公式）
function calculateDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 6371e3;
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
	const address = process.argv[2] || "東京都千代田区丸の内1-9-1";

	console.log("=== 周辺施設マップ生成テスト ===");
	console.log(`住所: ${address}`);

	if (!GOOGLE_MAPS_API_KEY) {
		console.error("GOOGLE_MAPS_API_KEY が設定されていません");
		process.exit(1);
	}

	const placesClient = new PlacesClient({ apiKey: GOOGLE_MAPS_API_KEY });

	// 1. 住所から座標を取得
	console.log("\n1. 住所をジオコーディング中...");
	const [geoResponse] = await placesClient.searchText(
		{
			textQuery: address,
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

	const place = geoResponse.places?.[0];
	if (!place?.location?.latitude || !place?.location?.longitude) {
		console.error("住所が見つかりませんでした");
		process.exit(1);
	}

	const centerLat = place.location.latitude;
	const centerLng = place.location.longitude;
	console.log(`   座標: ${centerLat}, ${centerLng}`);

	// 2. 周辺施設を検索
	console.log("\n2. 周辺施設を検索中...");
	const facilities: Facility[] = [];

	for (const category of FACILITY_CATEGORIES) {
		console.log(`   ${category.name} を検索中...`);

		try {
			const [response] = await placesClient.searchNearby(
				{
					includedTypes: [category.type],
					maxResultCount: 3,
					locationRestriction: {
						circle: {
							center: { latitude: centerLat, longitude: centerLng },
							radius: SEARCH_RADIUS,
						},
					},
					languageCode: "ja",
				},
				{
					otherArgs: {
						headers: {
							"X-Goog-FieldMask":
								"places.displayName,places.location",
						},
					},
				},
			);

			if (response.places) {
				for (const p of response.places) {
					if (p.location?.latitude && p.location?.longitude) {
						const dist = calculateDistance(
							centerLat,
							centerLng,
							p.location.latitude,
							p.location.longitude,
						);
						facilities.push({
							name: p.displayName?.text || "不明",
							category: category.name,
							categoryLabel: category.label,
							color: category.color,
							icon: category.icon,
							lat: p.location.latitude,
							lng: p.location.longitude,
							distanceMeters: Math.round(dist),
							walkMinutes: Math.ceil(dist / WALKING_SPEED),
						});
					}
				}
			}
		} catch (e) {
			console.error(`   ${category.name} の検索でエラー:`, e);
		}
	}

	console.log(`\n   合計 ${facilities.length} 件の施設を発見`);

	// 3. 施設一覧を表示
	console.log("\n3. 施設一覧:");
	for (const f of facilities) {
		console.log(
			`   [${f.categoryLabel}] ${f.category}: ${f.name} - ${f.distanceMeters}m (徒歩${f.walkMinutes}分)`,
		);
	}

	// 4. Static Map URL を生成
	console.log("\n4. Static Map URL を生成中...");

	const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
	url.searchParams.append("center", `${centerLat},${centerLng}`);
	url.searchParams.append("zoom", "16");
	url.searchParams.append("size", "640x480");
	url.searchParams.append("scale", "2");
	url.searchParams.append("maptype", "roadmap");
	url.searchParams.append("language", "ja");

	// 物件マーカー（赤）
	url.searchParams.append(
		"markers",
		`color:red|label:P|${centerLat},${centerLng}`,
	);

	// 施設マーカー
	for (const f of facilities) {
		if (f.icon) {
			url.searchParams.append(
				"markers",
				`icon:${f.icon}|${f.lat},${f.lng}`,
			);
		} else {
			url.searchParams.append(
				"markers",
				`color:${f.color}|label:${f.categoryLabel}|${f.lat},${f.lng}`,
			);
		}
	}

	url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

	console.log(`   URL生成完了`);

	// 5. 画像を取得して保存
	console.log("\n5. 画像を取得中...");
	const response = await fetch(url.toString());
	if (!response.ok) {
		console.error(`   画像取得エラー: ${response.status}`);
		process.exit(1);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	const outputPath = "test-nearby-map.png";
	writeFileSync(outputPath, buffer);

	console.log(`\n✅ 完了! 画像を保存しました: ${outputPath}`);
	console.log("\n凡例:");
	console.log("   P (赤): 物件");
	for (const cat of FACILITY_CATEGORIES) {
		console.log(`   ${cat.label} (${cat.color}): ${cat.name}`);
	}
}

main().catch(console.error);
