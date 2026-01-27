/**
 * HeartRails Express API クライアント
 *
 * 緯度・経度から最寄り駅情報を取得する
 * https://express.heartrails.com/api.html
 */

const HEARTRAILS_BASE_URL = "https://express.heartrails.com/api/json";

/**
 * 最寄り駅情報（APIレスポンス）
 */
interface StationResponse {
  name: string;
  prefecture: string;
  line: string;
  x: number; // 経度
  y: number; // 緯度
  postal: string;
  distance: string; // "160m" のような形式
  prev: string | null;
  next: string | null;
}

/**
 * APIレスポンス
 */
interface HeartRailsResponse {
  response: {
    station: StationResponse[];
  };
}

/**
 * 最寄り駅情報（整形済み）
 */
export interface NearestStationInfo {
  /** 駅名 */
  name: string;
  /** 利用可能路線 */
  lines: string[];
  /** 距離（メートル） */
  distanceMeters: number;
  /** 徒歩分数（80m/分で計算） */
  walkMinutes: number;
  /** 緯度 */
  lat: number;
  /** 経度 */
  lng: number;
}

/**
 * HeartRails Express APIクライアントクラス
 */
export class HeartRailsClient {
  /**
   * 緯度・経度から最寄り駅情報を取得
   * @param lat 緯度
   * @param lng 経度
   * @returns 最寄り駅情報（同じ駅の路線をまとめたもの）
   */
  async getNearestStations(
    lat: number,
    lng: number
  ): Promise<NearestStationInfo[]> {
    try {
      const url = new URL(HEARTRAILS_BASE_URL);
      url.searchParams.set("method", "getStations");
      url.searchParams.set("x", lng.toString()); // 経度
      url.searchParams.set("y", lat.toString()); // 緯度

      console.log(`[HeartRails] Fetching nearest stations for (${lat}, ${lng})`);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HeartRails API error: ${response.status}`);
      }

      const data: HeartRailsResponse = await response.json();
      const stations = data.response?.station;

      if (!stations || stations.length === 0) {
        console.warn("[HeartRails] No stations found");
        return [];
      }

      // 同じ駅名の路線をまとめる
      const stationMap = new Map<string, NearestStationInfo>();

      for (const station of stations) {
        const existing = stationMap.get(station.name);
        const distanceMeters = this.parseDistance(station.distance);
        const walkMinutes = Math.ceil(distanceMeters / 80); // 80m/分

        if (existing) {
          // 同じ駅名があれば路線を追加
          if (!existing.lines.includes(station.line)) {
            existing.lines.push(station.line);
          }
        } else {
          // 新しい駅を追加
          stationMap.set(station.name, {
            name: station.name,
            lines: [station.line],
            distanceMeters,
            walkMinutes,
            lat: station.y,
            lng: station.x,
          });
        }
      }

      // Mapを配列に変換（距離順）
      const result = Array.from(stationMap.values()).sort(
        (a, b) => a.distanceMeters - b.distanceMeters
      );

      console.log(
        `[HeartRails] Found ${result.length} unique stations:`,
        result.map((s) => `${s.name} (${s.walkMinutes}分)`).join(", ")
      );

      return result;
    } catch (error) {
      console.error("[HeartRails] Error fetching stations:", error);
      return [];
    }
  }

  /**
   * 緯度・経度から最も近い駅を取得
   */
  async getNearestStation(
    lat: number,
    lng: number
  ): Promise<NearestStationInfo | null> {
    const stations = await this.getNearestStations(lat, lng);
    return stations.length > 0 ? stations[0] : null;
  }

  /**
   * 距離文字列をメートルに変換
   * "160m" -> 160
   * "1.2km" -> 1200
   */
  private parseDistance(distance: string): number {
    const match = distance.match(/^([\d.]+)(m|km)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    return unit === "km" ? value * 1000 : value;
  }
}

/**
 * デフォルトのHeartRailsクライアントインスタンス
 */
export const heartRailsClient = new HeartRailsClient();
