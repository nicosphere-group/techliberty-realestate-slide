/**
 * Ekispert API モジュール
 *
 * 駅すぱあとWebサービス（Ekispert）を使用した
 * 路線図マップデータ取得機能を提供
 */

export { EkispertClient, ekispertClient } from "./client";
export type {
	EkispertLine,
	EkispertStation,
	NearestStation,
	RouteMapData,
	RouteResult,
} from "./types";
export { AIRPORTS, MAJOR_STATIONS } from "./types";
