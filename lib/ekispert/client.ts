/**
 * Ekispert API クライアント
 *
 * 駅すぱあとWebサービス（Ekispert）を使用して
 * 最寄り駅検索と経路探索を行う
 */

import type {
  AddressStationResponse,
  AreaName,
  CourseSearchResponse,
  NearestStation,
  RouteMapData,
  RouteResult,
  StationLinesResponse,
} from "./types";
import {
  AIRPORTS,
  AREA_KEYWORDS,
  AREA_SEARCH_MAPPING,
  MAJOR_STATIONS,
} from "./types";

const EKISPERT_BASE_URL = "http://api.ekispert.jp";

/**
 * Ekispert APIクライアントクラス
 */
export class EkispertClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.EKISPERT_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("[EkispertClient] EKISPERT_API_KEY is required");
    }
  }

  /**
   * 駅名から駅情報を検索
   */
  async searchStationByName(stationName: string): Promise<NearestStation | null> {
    try {
      const url = new URL(`${EKISPERT_BASE_URL}/v1/json/station`);
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("name", stationName);

      console.log(`[Ekispert] Searching station: ${stationName}`);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Ekispert API error: ${response.status}`);
      }

      const data: AddressStationResponse = await response.json();
      const points = data.ResultSet.Point;
      if (!points) {
        console.warn("[Ekispert] Station not found:", stationName);
        return null;
      }

      const pointArray = Array.isArray(points) ? points : [points];
      // 電車駅のみをフィルタ（バス停を除外）
      const trainStation = pointArray.find(p => p.Station.Type === "train");
      if (!trainStation) {
        console.warn("[Ekispert] No train station found for:", stationName);
        return null;
      }

      const station = trainStation.Station;
      const lines = await this.getStationLines(station.code);

      return {
        name: station.Name,
        code: station.code,
        distance: 0,
        walkMinutes: 0,
        lines,
      };
    } catch (error) {
      console.error("[Ekispert] Error searching station:", error);
      throw error;
    }
  }

  /**
   * 住所から都道府県エリアを判定
   */
  private detectAreaFromAddress(address: string): AreaName {
    for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
      for (const keyword of keywords) {
        if (address.includes(keyword)) {
          console.log(`[Ekispert] Detected area: ${area} (matched: ${keyword})`);
          return area as AreaName;
        }
      }
    }
    // デフォルトは東京（全エリア検索）
    console.log("[Ekispert] Could not detect area, defaulting to tokyo");
    return "tokyo";
  }

  /**
   * エリアに基づいて検索対象の駅リストを取得
   */
  private getStationsForArea(area: AreaName): Array<{ name: string; code: string }> {
    const searchAreas = AREA_SEARCH_MAPPING[area];
    const stations: Array<{ name: string; code: string }> = [];

    for (const searchArea of searchAreas) {
      stations.push(...MAJOR_STATIONS[searchArea]);
    }

    console.log(`[Ekispert] Searching ${stations.length} stations for area: ${area} (${searchAreas.join(", ")})`);
    return stations;
  }

  /**
   * 駅の路線情報を取得
   */
  private async getStationLines(stationCode: string): Promise<string[]> {
    try {
      const url = new URL(`${EKISPERT_BASE_URL}/v1/json/station/info`);
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("code", stationCode);
      url.searchParams.set("type", "rail");

      const response = await fetch(url.toString());
      if (!response.ok) {
        return [];
      }

      const data: StationLinesResponse = await response.json();
      const lines = data.ResultSet.Line;
      if (!lines) {
        return [];
      }

      const lineArray = Array.isArray(lines) ? lines : [lines];
      return lineArray.map((line) => line.Name);
    } catch (error) {
      console.error("[Ekispert] Error getting station lines:", error);
      return [];
    }
  }

  /**
   * 経路探索を実行
   */
  async searchRoute(
    fromStationCode: string,
    toStationCode: string
  ): Promise<RouteResult | null> {
    try {
      const url = new URL(`${EKISPERT_BASE_URL}/v1/json/search/course/extreme`);
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("viaList", `${fromStationCode}:${toStationCode}`);

      console.log(`[Ekispert] Searching route: ${fromStationCode} -> ${toStationCode}`);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Ekispert API error: ${response.status}`);
      }

      const data: CourseSearchResponse = await response.json();
      const courses = data.ResultSet.Course;

      if (!courses) {
        console.warn("[Ekispert] No route found");
        return null;
      }

      // 配列でない場合は配列に変換
      const courseArray = Array.isArray(courses) ? courses : [courses];
      if (courseArray.length === 0) {
        return null;
      }

      const course = courseArray[0];
      const route = course.Route;

      // 所要時間を計算（乗車時間 + 乗り換え徒歩時間）
      const timeOnBoard = Number.parseInt(route.timeOnBoard || "0", 10);
      const timeWalk = Number.parseInt(route.timeWalk || "0", 10);
      const totalMinutes = timeOnBoard + timeWalk;

      // 乗換回数
      const transferCount = Number.parseInt(route.transferCount || "0", 10);

      // 経路概要を生成
      const routeSummary = this.buildRouteSummary(route.Line);

      // 到着駅名を取得
      const points = route.Point;
      let destination = "";
      if (points && Array.isArray(points) && points.length > 0) {
        destination = points[points.length - 1].Station.Name;
      }

      // 主要路線を抽出
      const mainLine = this.extractMainLine(route.Line);

      return {
        destination,
        totalMinutes,
        transferCount,
        routeSummary,
        mainLine,
      };
    } catch (error) {
      console.error("[Ekispert] Error searching route:", error);
      return null;
    }
  }

  /**
   * 経路概要を生成
   */
  private buildRouteSummary(
    lines:
      | Array<{ Name: string; Type?: string }>
      | { Name: string; Type?: string }
      | undefined
  ): string {
    if (!lines) {
      return "";
    }

    const lineArray = Array.isArray(lines) ? lines : [lines];
    const railLines = lineArray.filter(
      (line) => line.Type !== "walk" && line.Type !== "transfer"
    );

    if (railLines.length === 0) {
      return "";
    }

    return railLines.map((line) => line.Name).join(" → ");
  }

  /**
   * 主要路線を抽出（SVG表示用）
   */
  private extractMainLine(
    lines:
      | Array<{ Name: string; Type?: string }>
      | { Name: string; Type?: string }
      | undefined
  ): string {
    if (!lines) {
      return "";
    }

    const lineArray = Array.isArray(lines) ? lines : [lines];
    const railLine = lineArray.find(
      (line) => line.Type !== "walk" && line.Type !== "transfer"
    );

    return railLine?.Name || "";
  }

  /**
   * 駅名と徒歩時間から路線図マップデータを取得
   */
  async getRouteMapDataByStation(
    stationName: string,
    walkMinutes: number = 5,
    address: string = ""
  ): Promise<RouteMapData> {
    const nearestStation = await this.searchStationByName(stationName);

    if (!nearestStation) {
      throw new Error(`駅が見つかりませんでした: ${stationName}`);
    }

    // 徒歩時間を設定
    nearestStation.walkMinutes = walkMinutes;

    return this.fetchRouteData(nearestStation, address);
  }

  /**
   * 経路データを取得（共通処理）
   * エリアに基づいて検索対象駅を絞り込む
   */
  private async fetchRouteData(
    nearestStation: NearestStation,
    address: string
  ): Promise<RouteMapData> {
    // 住所からエリアを判定し、検索対象駅を絞り込む
    const area = this.detectAreaFromAddress(address);
    const targetStations = this.getStationsForArea(area);

    // 主要駅への経路を並列で検索
    const stationRoutePromises = targetStations.map(async (station) => {
      const route = await this.searchRoute(
        nearestStation.code,
        station.code
      );
      if (route) {
        return {
          ...route,
          destination: station.name,
        };
      }
      return null;
    });

    // 空港への経路を並列で検索
    const airportRoutePromises = AIRPORTS.map(async (airport) => {
      const route = await this.searchRoute(
        nearestStation.code,
        airport.code
      );
      if (route) {
        return {
          ...route,
          destination: airport.displayName,
        };
      }
      return null;
    });

    // 全ての経路検索を待機
    const [stationResults, airportResults] = await Promise.all([
      Promise.all(stationRoutePromises),
      Promise.all(airportRoutePromises),
    ]);

    // nullを除去
    const stationRoutes: RouteResult[] = stationResults.filter(
      (r): r is NonNullable<typeof r> => r !== null
    );
    const airportRoutes: RouteResult[] = airportResults.filter(
      (r): r is NonNullable<typeof r> => r !== null
    );

    if (stationRoutes.length === 0) {
      throw new Error(`経路が取得できませんでした: ${nearestStation.name}`);
    }

    return {
      propertyAddress: address,
      nearestStation,
      stationRoutes,
      airportRoutes,
    };
  }
}

/**
 * デフォルトのEkispertクライアントインスタンス
 */
export const ekispertClient = new EkispertClient();
