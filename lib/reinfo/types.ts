export type ResponseLanguage = "ja" | "en";
export type ReinfoRecord = Record<string, unknown>;
export type GeoJsonLike = { type: string; [key: string]: unknown };

export interface ReinfoApiResponse<T> {
	status: string;
	data: T;
}

export type TileResponse = GeoJsonLike;

export interface ReinfoClientOptions {
	apiKey: string;
	baseUrl?: string;
	timeoutMs?: number;
	userAgent?: string;
}

export interface PriceInfoParams {
	year: number;
	quarter?: 1 | 2 | 3 | 4;
	area?: string;
	city?: string;
	station?: string;
	priceClassification?: "01" | "02";
	language?: ResponseLanguage;
}

export interface MunicipalityListParams {
	area: string;
	language?: ResponseLanguage;
}

export interface AppraisalReportParams {
	year: number;
	area: string;
	division: string;
}

export interface TileBaseParams {
	z: number;
	x: number;
	y: number;
}

export interface PricePointParams extends TileBaseParams {
	from: number | string;
	to: number | string;
	priceClassification?: "01" | "02";
	landTypeCode?: string | Array<string | number>;
}

export interface LandPricePointParams extends TileBaseParams {
	year: number;
	priceClassification?: "0" | "1";
	useCategoryCode?: string | Array<string | number>;
}

export interface PrimarySchoolDistrictParams extends TileBaseParams {
	administrativeAreaCode?: string | Array<string | number>;
}

export interface MiddleSchoolDistrictParams extends TileBaseParams {
	administrativeAreaCode?: string | Array<string | number>;
}

export interface WelfareFacilityParams extends TileBaseParams {
	administrativeAreaCode?: string | Array<string | number>;
	welfareFacilityClassCode?: string | Array<string | number>;
	welfareFacilityMiddleClassCode?: string | Array<string | number>;
	welfareFacilityMinorClassCode?: string | Array<string | number>;
}

export interface DisasterRiskParams extends TileBaseParams {
	administrativeAreaCode?: string | Array<string | number>;
}

export interface LibraryParams extends TileBaseParams {
	administrativeAreaCode?: string | Array<string | number>;
}

export interface NaturalParkParams extends TileBaseParams {
	prefectureCode?: string | Array<string | number>;
	districtCode?: string | Array<string | number>;
}

export interface LandslidePreventionParams extends TileBaseParams {
	prefectureCode?: string | Array<string | number>;
	administrativeAreaCode?: string | Array<string | number>;
}

export interface SteepSlopeParams extends TileBaseParams {
	prefectureCode?: string | Array<string | number>;
	administrativeAreaCode?: string | Array<string | number>;
}
