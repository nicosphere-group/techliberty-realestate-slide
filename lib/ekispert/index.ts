/**
 * Ekispert API モジュール
 *
 * 駅すぱあとWebサービス（Ekispert）を使用した
 * 路線図マップデータ取得機能を提供
 */

export { EkispertClient, ekispertClient } from "./client";
export type {
  NearestStation,
  RouteResult,
  RouteMapData,
  EkispertStation,
  EkispertLine,
} from "./types";
export { MAJOR_STATIONS, AIRPORTS } from "./types";
