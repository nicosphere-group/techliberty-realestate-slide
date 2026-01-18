import ky, { HTTPError, type KyInstance } from "ky";

import {
	API_KEY_HEADER,
	DEFAULT_TIMEOUT_MS,
	REINFO_BASE_URL,
} from "./constants";
import type {
	AppraisalReportParams,
	DisasterRiskParams,
	GeoJsonLike,
	LandPricePointParams,
	LandslidePreventionParams,
	LibraryParams,
	MiddleSchoolDistrictParams,
	MunicipalityListParams,
	NaturalParkParams,
	PriceInfoParams,
	PricePointParams,
	PrimarySchoolDistrictParams,
	ReinfoApiResponse,
	ReinfoClientOptions,
	ReinfoRecord,
	SteepSlopeParams,
	TileResponse,
	WelfareFacilityParams,
} from "./types";
import { buildSearchParams, type SearchParamValue } from "./utils";

export class ReinfoError extends Error {
	constructor(
		message: string,
		public override cause?: unknown,
		public status?: number,
	) {
		super(message);
		this.name = "ReinfoError";
	}
}

export class ReinfoClient {
	private readonly instance: KyInstance;

	constructor(options: ReinfoClientOptions) {
		this.instance = ky.create({
			prefixUrl: options.baseUrl ?? REINFO_BASE_URL,
			timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
			headers: {
				[API_KEY_HEADER]: options.apiKey,
				...(options.userAgent ? { "User-Agent": options.userAgent } : {}),
			},
		});
	}

	private toSearchParams<T extends object>(
		params: T,
	): Record<string, SearchParamValue> {
		return params as unknown as Record<string, SearchParamValue>;
	}

	private async requestJson<T>(
		path: string,
		params: Record<string, SearchParamValue>,
	): Promise<ReinfoApiResponse<T>> {
		try {
			const response = await this.instance.get(path, {
				searchParams: buildSearchParams(params),
			});
			const payload = (await response.json()) as ReinfoApiResponse<T>;
			if (!payload || payload.status !== "OK") {
				throw new ReinfoError(
					`Reinfo API response status is not OK: ${path}`,
					payload,
				);
			}
			return payload;
		} catch (error) {
			throw await this.toReinfoError(error, path);
		}
	}

	private async requestTile(
		path: string,
		params: Record<string, SearchParamValue>,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return (await this.requestJson<GeoJsonLike>(path, {
			...params,
			response_format: "geojson",
		})) as ReinfoApiResponse<TileResponse>;
	}

	private async toReinfoError(
		error: unknown,
		path: string,
	): Promise<ReinfoError> {
		if (error instanceof HTTPError) {
			let message = `Reinfo API request failed: ${path}`;
			try {
				const body = await error.response.text();
				if (body) {
					message = `${message} - ${body}`;
				}
			} catch {
				// ignore body parse errors
			}
			return new ReinfoError(message, error, error.response.status);
		}

		return new ReinfoError(`Reinfo API request failed: ${path}`, error);
	}

	async getPriceInfo(
		params: PriceInfoParams,
	): Promise<ReinfoApiResponse<ReinfoRecord[]>> {
		return this.requestJson<ReinfoRecord[]>(
			"XIT001",
			this.toSearchParams(params),
		);
	}

	async getMunicipalities(
		params: MunicipalityListParams,
	): Promise<ReinfoApiResponse<ReinfoRecord[]>> {
		return this.requestJson<ReinfoRecord[]>(
			"XIT002",
			this.toSearchParams(params),
		);
	}

	async getAppraisalReports(
		params: AppraisalReportParams,
	): Promise<ReinfoApiResponse<ReinfoRecord[]>> {
		return this.requestJson<ReinfoRecord[]>(
			"XCT001",
			this.toSearchParams(params),
		);
	}

	async getPricePoints(
		params: PricePointParams,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XPT001", this.toSearchParams(params));
	}

	async getLandPricePoints(
		params: LandPricePointParams,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XPT002", this.toSearchParams(params));
	}

	async getUrbanPlanningArea(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT001", this.toSearchParams(params));
	}

	async getUrbanPlanningUse(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT002", this.toSearchParams(params));
	}

	async getLocationOptimizationPlan(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT003", this.toSearchParams(params));
	}

	async getPrimarySchoolDistricts(
		params: PrimarySchoolDistrictParams,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT004", this.toSearchParams(params));
	}

	async getMiddleSchoolDistricts(
		params: MiddleSchoolDistrictParams,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT005", this.toSearchParams(params));
	}

	async getSchools(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT006", this.toSearchParams(params));
	}

	async getPreschools(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT007", this.toSearchParams(params));
	}

	async getMedicalFacilities(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT010", this.toSearchParams(params));
	}

	async getWelfareFacilities(
		params: WelfareFacilityParams,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT011", this.toSearchParams(params));
	}

	async getFuturePopulationMesh(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT013", this.toSearchParams(params));
	}

	async getFirePreventionAreas(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT014", this.toSearchParams(params));
	}

	async getStationPassengers(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT015", this.toSearchParams(params));
	}

	async getDisasterRiskAreas(
		params: DisasterRiskParams,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT016", this.toSearchParams(params));
	}

	async getLibraries(
		params: LibraryParams,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT017", this.toSearchParams(params));
	}

	async getCityHalls(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT018", this.toSearchParams(params));
	}

	async getNaturalParks(
		params: NaturalParkParams,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT019", this.toSearchParams(params));
	}

	async getLargeScaleEmbankmentMap(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT020", this.toSearchParams(params));
	}

	async getLandslidePreventionAreas(
		params: LandslidePreventionParams,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT021", this.toSearchParams(params));
	}

	async getSteepSlopeAreas(
		params: SteepSlopeParams,
	): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT022", this.toSearchParams(params));
	}

	async getDistrictPlans(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT023", this.toSearchParams(params));
	}

	async getAdvancedUseDistricts(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT024", this.toSearchParams(params));
	}

	async getLiquefactionTendency(params: {
		z: number;
		x: number;
		y: number;
	}): Promise<ReinfoApiResponse<TileResponse>> {
		return this.requestTile("XKT025", this.toSearchParams(params));
	}
}
