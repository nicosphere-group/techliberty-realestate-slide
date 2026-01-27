/**
 * 路線図マップ画像生成ツール
 *
 * Leaflet + CartoDB Positronで地図を描画し、
 * PuppeteerでスクリーンショットをS3にアップロードして公開URLを返す
 */

import { tool } from "ai";
import puppeteer from "puppeteer";
import z from "zod";
import { EkispertClient } from "../../ekispert/client";
import type { RouteMapData } from "../../ekispert/types";
import { heartRailsClient } from "../../heartrails/client";
import { uploadToS3 } from "../utils/upload";

/**
 * 首都圏主要ターミナル駅の座標
 */
const TERMINAL_STATIONS: Record<string, { lat: number; lng: number }> = {
  // 東京都心エリア
  東京: { lat: 35.6812, lng: 139.7671 },
  新宿: { lat: 35.6896, lng: 139.7006 },
  渋谷: { lat: 35.658, lng: 139.7016 },
  池袋: { lat: 35.7295, lng: 139.7109 },
  品川: { lat: 35.6284, lng: 139.7387 },
  上野: { lat: 35.7141, lng: 139.7774 },
  // 神奈川エリア
  横浜: { lat: 35.4657, lng: 139.6224 },
  川崎: { lat: 35.5314, lng: 139.6969 },
  新横浜: { lat: 35.5065, lng: 139.6176 },
  // 埼玉エリア
  大宮: { lat: 35.9063, lng: 139.6240 },
  // 千葉エリア
  千葉: { lat: 35.6131, lng: 140.1136 },
  船橋: { lat: 35.7017, lng: 139.9855 },
};

/**
 * 路線カラー（主要駅ごと）
 * 各駅の代表的な路線色を設定
 */
const LINE_COLORS: Record<string, string> = {
  // 東京都心エリア
  東京: "#e60012", // 丸ノ内線レッド
  新宿: "#69c055", // JR山手線グリーン
  渋谷: "#f7931e", // 銀座線オレンジ
  池袋: "#e60012", // 丸ノ内線レッド
  品川: "#69c055", // JR山手線グリーン
  上野: "#b5b5ac", // 日比谷線シルバー
  // 神奈川エリア
  横浜: "#0068b7", // 横浜市営地下鉄ブルーライン
  川崎: "#00a0de", // JR京浜東北線スカイブルー
  新横浜: "#009bbf", // 横浜市営地下鉄ブルーライン
  // 埼玉エリア
  大宮: "#f68b1e", // JR湘南新宿ラインオレンジ
  // 千葉エリア
  千葉: "#00b5ad", // JR総武線ティール
  船橋: "#00a7db", // 東西線スカイブルー
};

/**
 * 空港座標
 */
const AIRPORTS = {
  羽田空港: { lat: 35.5494, lng: 139.7798 },
  成田空港: { lat: 35.772, lng: 140.3929 },
};

interface RouteMapImageInput {
  /** 物件住所 */
  address: string;
  /** 最寄り駅名（マイソクから取得） */
  nearestStationName?: string;
  /** 最寄り駅への徒歩分数（マイソクから取得） */
  walkMinutes?: number;
}

interface RouteMapImageResult {
  /** 地図画像のBase64データURL */
  mapImageUrl: string;
  /** 路線図マップデータ */
  routeMapData: RouteMapData;
}

/**
 * 物件座標を住所からジオコーディング
 * 1. Google Maps Geocoding API（APIキーがある場合）
 * 2. Nominatim (OpenStreetMap) をフォールバックとして使用
 */
async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  // まずGoogle Maps APIを試行
  const googleResult = await geocodeWithGoogle(address);
  if (googleResult) {
    return googleResult;
  }

  // フォールバック: Nominatim (OpenStreetMap)
  const nominatimResult = await geocodeWithNominatim(address);
  if (nominatimResult) {
    return nominatimResult;
  }

  console.warn(`[RouteMapImage] All geocoding methods failed for: ${address}`);
  return null;
}

/**
 * Google Maps Geocoding API
 */
async function geocodeWithGoogle(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.log("[RouteMapImage] Google Maps API key not set, trying Nominatim...");
    return null;
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("language", "ja");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
      const { lat, lng } = data.results[0].geometry.location;
      console.log(`[RouteMapImage] Google geocoded ${address} to (${lat}, ${lng})`);
      return { lat, lng };
    }

    console.log(`[RouteMapImage] Google geocoding failed: ${data.status}, trying Nominatim...`);
    return null;
  } catch (error) {
    console.error("[RouteMapImage] Google geocoding error:", error);
    return null;
  }
}

/**
 * Nominatim (OpenStreetMap) Geocoding API
 * 無料で利用可能、APIキー不要
 */
async function geocodeWithNominatim(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "jp");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "TechLiberty-RealEstate-Slide/1.0",
      },
    });
    const data = await response.json();

    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      console.log(`[RouteMapImage] Nominatim geocoded ${address} to (${lat}, ${lng})`);
      return { lat, lng };
    }

    console.warn(`[RouteMapImage] Nominatim geocoding failed for: ${address}`);
    return null;
  } catch (error) {
    console.error("[RouteMapImage] Nominatim geocoding error:", error);
    return null;
  }
}

/**
 * ハイブリッド最寄り駅選択ロジック
 *
 * 1. マイソクの最寄り駅がAPI結果に含まれていれば → そちらを優先（検証済み）
 * 2. マイソク駅がAPI結果にないが、徒歩15分以内と記載 → マイソクを信頼して使用
 *    （ジオコーディングが不正確でもマイソクの情報を優先）
 * 3. それ以外 → APIの最短距離駅を使用
 *
 * @param apiStations HeartRails APIから取得した駅リスト
 * @param maisokuStationName マイソクに記載された最寄り駅名
 * @param maisokuWalkMinutes マイソクに記載された徒歩分数
 */
function selectBestStation(
  apiStations: Array<{
    name: string;
    lines: string[];
    distanceMeters: number;
    walkMinutes: number;
    lat: number;
    lng: number;
  }>,
  maisokuStationName?: string,
  maisokuWalkMinutes?: number
): {
  name: string;
  lines: string[];
  distanceMeters: number;
  walkMinutes: number;
  lat: number;
  lng: number;
} | null {
  // マイソクの駅名がある場合
  if (maisokuStationName) {
    // API結果から検索
    const matchedStation = apiStations.find(
      (s) => s.name === maisokuStationName || s.name.includes(maisokuStationName) || maisokuStationName.includes(s.name)
    );

    if (matchedStation) {
      console.log(
        `[RouteMapImage] Maisoku station "${maisokuStationName}" found in API results → using it (verified)`
      );
      // マイソクの徒歩分数が指定されていれば、そちらを優先
      if (maisokuWalkMinutes !== undefined) {
        return {
          ...matchedStation,
          walkMinutes: maisokuWalkMinutes,
          distanceMeters: maisokuWalkMinutes * 80,
        };
      }
      return matchedStation;
    }

    // マイソク駅がAPI結果にないが、徒歩15分以内 → マイソクを信頼
    // （ジオコーディングが不正確な可能性が高い）
    if (maisokuWalkMinutes !== undefined && maisokuWalkMinutes <= 15) {
      console.log(
        `[RouteMapImage] Maisoku station "${maisokuStationName}" (${maisokuWalkMinutes}min) NOT in API results ` +
          `but walk time is reasonable → trusting maisoku`
      );
      // マイソク駅を返す（路線情報なし、後でEkispertで取得される）
      return null; // nullを返してマイソクのみモードにする
    }

    console.log(
      `[RouteMapImage] Maisoku station "${maisokuStationName}" NOT found in API results ` +
        `(API stations: ${apiStations.map((s) => s.name).join(", ")}) → using closest API station`
    );
  }

  // マイソク駅が見つからない、または指定されていない場合は最短距離駅を使用
  if (apiStations.length === 0) {
    return null;
  }
  return apiStations[0];
}

/**
 * Leaflet地図のHTMLを生成
 */
function generateMapHtml(
  home: { lat: number; lng: number },
  stations: Array<{ name: string; lat: number; lng: number; minutes: number }>,
  airports: Array<{ name: string; lat: number; lng: number; minutes: number }>
): string {
  const stationsJson = JSON.stringify(stations);
  const airportsJson = JSON.stringify(airports);
  const lineColorsJson = JSON.stringify(LINE_COLORS);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 500px; height: 500px; overflow: hidden; background: #fff; }
        
        #map {
            width: 500px;
            height: 500px;
            background: #fff;
        }
        
        .leaflet-tile-pane {
            filter: contrast(1.05) saturate(0.8); 
        }

        .leaflet-pane, .leaflet-map-pane, .leaflet-marker-pane { overflow: visible !important; }
        .leaflet-control-zoom, .leaflet-control-attribution { display: none !important; }

        /* HOMEマーカー（調整済み） */
        .home-marker {
            background: linear-gradient(135deg, #bea072 0%, #9c7e52 100%);
            border: 2px solid #fff;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 3000 !important;
            
            /* 文字のスタイル調整 */
            color: #fff;
            font-family: 'Montserrat', sans-serif;
            font-weight: 700;
            font-size: 9px; /* 10px -> 9px に縮小 */
            letter-spacing: 0.08em; /* 文字間を少し広げてバランスを取る */
        }

        /* 駅ラベル */
        .spot-label {
            font-family: "Noto Sans JP", sans-serif;
            font-weight: 700;
            font-size: 14px;
            color: #333;
            text-shadow:
                3px 0 0 #fff, -3px 0 0 #fff,
                0 3px 0 #fff, 0 -3px 0 #fff,
                2px 2px 0 #fff, -2px -2px 0 #fff,
                2px -2px 0 #fff, -2px 2px 0 #fff;
            white-space: nowrap;
            line-height: 1.1;
            letter-spacing: 0.05em;
        }
        .spot-label .minutes {
            font-size: 12px;
            color: #666;
            font-weight: 500;
            margin-left: 2px;
        }

        /* 空港ラベル（幅調整済み） */
        .airport-badge {
            background: #9c7e52; 
            color: #fff;
            padding: 5px 10px; /* パディングを微調整 */
            border-radius: 50px;
            font-family: "Noto Sans JP", sans-serif;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            border: 1.5px solid #fff;
            display: flex;
            align-items: center;
            justify-content: center; /* 中央揃え */
            gap: 4px;
            letter-spacing: 0.05em;
            width: 100%; /* 親要素(divIcon)の幅いっぱいに広げる */
        }
        .airport-badge::before {
            content: "✈";
            font-size: 11px;
        }
    </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
    const home = ${JSON.stringify(home)};
    const stations = ${stationsJson};
    const airports = ${airportsJson};
    const lineColors = ${lineColorsJson};

    const map = L.map('map', {
        zoomControl: false,
        dragging: false,
        attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    const features = [];
    
    // 1. HOMEマーカー（サイズ調整）
    const homeIcon = L.divIcon({
        className: 'home-marker',
        html: 'HOME',
        iconSize: [40, 40], // 38 -> 40 に拡大
        iconAnchor: [20, 20] // 中心位置を調整
    });
    const homeMarker = L.marker([home.lat, home.lng], { icon: homeIcon }).addTo(map);
    features.push(homeMarker);

    // ベジェ曲線関数
    function getCurvePoints(start, end, bendFactor = 0.1) {
        const lat1 = start.lat, lng1 = start.lng;
        const lat2 = end.lat, lng2 = end.lng;
        const midLat = (lat1 + lat2) / 2;
        const midLng = (lng1 + lng2) / 2;
        const controlLat = midLat - (lng2 - lng1) * bendFactor;
        const controlLng = midLng + (lat2 - lat1) * bendFactor;
        
        const points = [];
        for (let t = 0; t <= 1; t += 0.02) {
            const x = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * controlLat + t * t * lat2;
            const y = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * controlLng + t * t * lng2;
            points.push([x, y]);
        }
        return points;
    }

    // 2. 主要駅の描画
    stations.forEach((station, i) => {
        const bendFactor = (i % 2 === 0 ? 1 : -1) * 0.12;
        const curvePoints = getCurvePoints(home, station, bendFactor);
        const color = lineColors[station.name] || '#666';

        L.polyline(curvePoints, { color: '#fff', weight: 8, opacity: 1.0 }).addTo(map);
        L.polyline(curvePoints, { color: color, weight: 4, opacity: 0.9 }).addTo(map);

        const stationIcon = L.divIcon({
            html: \`<div style="width:12px;height:12px;background:\${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>\`,
            className: '', iconSize: [12, 12], iconAnchor: [6, 6]
        });
        const m = L.marker([station.lat, station.lng], { icon: stationIcon }).addTo(map);
        features.push(m);

        const isRight = station.lng > home.lng;
        L.marker([station.lat, station.lng], {
            icon: L.divIcon({
                className: 'custom-label',
                html: \`<div class="spot-label" style="text-align:\${isRight ? 'left' : 'right'}">\${station.name}駅<span class="minutes">\${station.minutes}分</span></div>\`,
                iconSize: [120, 24],
                iconAnchor: [isRight ? -8 : 128, 12]
            })
        }).addTo(map);
    });

    // 3. 画角
    if (features.length > 0) {
        const group = L.featureGroup(features);
        map.fitBounds(group.getBounds(), { padding: [80, 80] });
    } else {
        map.setView([home.lat, home.lng], 13);
    }

    // 4. 空港アクセス（幅・位置調整）
    const mapSize = map.getSize();
    const layoutConfig = {
        // x座標を少し右にずらし、アンカーを中心に設定
        '成田': { x: mapSize.x - 65, y: 50, anchor: [55, 13], bendFactor: -0.15 },
        '羽田': { x: mapSize.x - 65, y: mapSize.y - 30, anchor: [55, 13], bendFactor: 0.15 }
    };

    airports.forEach(airport => {
        let config = null;
        if (airport.name.includes('成田')) config = layoutConfig['成田'];
        else config = layoutConfig['羽田'];
        if (!config) return;

        const targetPoint = L.point(config.x, config.y);
        const targetLatLng = map.containerPointToLatLng(targetPoint);
        const curvePoints = getCurvePoints(home, {lat: targetLatLng.lat, lng: targetLatLng.lng}, config.bendFactor);

        L.polyline(curvePoints, {
            color: '#9c7e52',
            weight: 2,
            dashArray: '4, 5', 
            opacity: 0.8,
            lineCap: 'round'
        }).addTo(map);

        const badgeIcon = L.divIcon({
            className: '',
            html: \`<div class="airport-badge">\${airport.name} \${airport.minutes}分</div>\`,
            iconSize: [110, 26], // 幅を140 -> 110に縮小
            iconAnchor: config.anchor
        });
        L.marker(targetLatLng, { icon: badgeIcon, zIndexOffset: 400 }).addTo(map);
    });

    setTimeout(() => { window.mapRendered = true; }, 2000);
</script>
</body>
</html>`;
}

/**
 * 路線図マップ画像生成ツール
 */
export const generateRouteMapImageTool = tool({
  description:
    "物件住所から路線図マップ画像とアクセス情報を生成する。Leaflet地図をPuppeteerでキャプチャしてBase64画像として返す。",
  inputSchema: z.object({
    address: z.string().describe("物件住所（例: 東京都港区白金台3-1-1）"),
    nearestStationName: z
      .string()
      .optional()
      .describe("最寄り駅名（マイソクから取得）"),
    walkMinutes: z
      .number()
      .optional()
      .describe("最寄り駅への徒歩分数（マイソクから取得）"),
  }),
  execute: async (params: RouteMapImageInput): Promise<RouteMapImageResult> => {
    const { address, nearestStationName, walkMinutes } = params;
    console.log(`[RouteMapImage] Starting for address: ${address}`);

    // Step 1: 物件座標を取得（ジオコーディング）
    const homeCoord = await geocodeAddress(address);
    if (!homeCoord) {
      throw new Error(`ジオコーディングに失敗しました: ${address}`);
    }

    // Step 2: HeartRails APIで最寄り駅リストを取得（複数駅）
    const apiStations = await heartRailsClient.getNearestStations(
      homeCoord.lat,
      homeCoord.lng
    );

    // Step 2.5: ハイブリッド選択ロジック
    // - マイソクの最寄り駅がAPI結果に含まれていれば → そちらを優先（信頼性が高い）
    // - 含まれていなければ → APIの最短距離駅を使用
    let nearestStationInfo = selectBestStation(apiStations, nearestStationName, walkMinutes);

    // 駅情報が取得できない場合はエラー
    if (!nearestStationInfo) {
      if (nearestStationName) {
        // マイソクの情報のみ使用
        nearestStationInfo = {
          name: nearestStationName,
          lines: [],
          distanceMeters: (walkMinutes || 5) * 80,
          walkMinutes: walkMinutes || 5,
          lat: homeCoord.lat,
          lng: homeCoord.lng,
        };
        console.log(`[RouteMapImage] Using maisoku station only: ${nearestStationName}`);
      } else {
        throw new Error(`最寄り駅が見つかりませんでした: ${address}`);
      }
    }

    console.log(
      `[RouteMapImage] Selected station: ${nearestStationInfo.name} ` +
        `(${nearestStationInfo.lines.join("・")}, 徒歩${nearestStationInfo.walkMinutes}分)`
    );

    // Step 3: Ekispert APIで経路データを取得
    const ekispertClient = new EkispertClient();
    const routeMapData = await ekispertClient.getRouteMapDataByStation(
      nearestStationInfo.name,
      nearestStationInfo.walkMinutes,
      address
    );

    // 選択した駅情報で上書き（Ekispert APIの結果より正確）
    routeMapData.nearestStation.name = nearestStationInfo.name;
    routeMapData.nearestStation.lines = nearestStationInfo.lines;
    routeMapData.nearestStation.walkMinutes = nearestStationInfo.walkMinutes;
    routeMapData.nearestStation.distance = nearestStationInfo.distanceMeters;

    console.log(
      `[RouteMapImage] Route data: nearestStation=${routeMapData.nearestStation.name}, ` +
        `stationRoutes=${routeMapData.stationRoutes.length}, ` +
        `airportRoutes=${routeMapData.airportRoutes.length}`
    );

    // Step 4: TOP4駅を選定（所要時間順）
    const top4Stations = [...routeMapData.stationRoutes]
      .sort((a, b) => a.totalMinutes - b.totalMinutes)
      .slice(0, 4)
      .map((route) => ({
        name: route.destination,
        lat: TERMINAL_STATIONS[route.destination]?.lat || 35.6812,
        lng: TERMINAL_STATIONS[route.destination]?.lng || 139.7671,
        minutes: route.totalMinutes,
      }));

    // Step 5: 空港データ
    const airportsData = routeMapData.airportRoutes.map((route) => ({
      name: route.destination,
      lat:
        AIRPORTS[route.destination as keyof typeof AIRPORTS]?.lat || 35.5494,
      lng:
        AIRPORTS[route.destination as keyof typeof AIRPORTS]?.lng || 139.7798,
      minutes: route.totalMinutes,
    }));

    // Step 6: Leaflet地図HTMLを生成
    const mapHtml = generateMapHtml(homeCoord, top4Stations, airportsData);

    // Step 7: Puppeteerでスクリーンショット取得
    console.log("[RouteMapImage] Launching Puppeteer...");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      // 高解像度設定（Retina相当）、若干横長
      await page.setViewport({ width: 500, height: 500, deviceScaleFactor: 3 });
      await page.setContent(mapHtml, { waitUntil: "networkidle0" });

      // 地図タイルの読み込みを待機
      await page.waitForFunction(() => (window as any).mapRendered === true, {
        timeout: 10000,
      });

      // 追加の待機（タイル描画完了用）
      await new Promise((resolve) => setTimeout(resolve, 500));

      const screenshotBuffer = await page.screenshot({
        type: "png",
      });

      // BufferをBlobに変換してS3にアップロード
      const blob = new Blob([Buffer.from(screenshotBuffer)], { type: "image/png" });
      const mapImageUrl = await uploadToS3(blob, "route-maps");
      console.log("[RouteMapImage] Screenshot uploaded to S3:", mapImageUrl);

      return {
        mapImageUrl,
        routeMapData,
      };
    } finally {
      await browser.close();
    }
  },
});

export type { RouteMapImageInput, RouteMapImageResult };
