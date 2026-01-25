import ky from "ky";
import sharp from "sharp";

export type LatLngLiteral = {
	lat: number;
	lng: number;
};

export type Location = string | LatLngLiteral;

export type StaticMapFormat = "png" | "png32" | "gif" | "jpg" | "jpg-baseline";

export type StaticMapType = "roadmap" | "satellite" | "hybrid" | "terrain";

export type StaticMapMarker = {
	location: Location;
	size?: "tiny" | "small" | "mid";
	color?: string;
	label?: string;
	icon?: string;
	anchor?: string;
	scale?: number;
};

export type StaticMapPath = {
	points?: Location[];
	encodedPath?: string;
	weight?: number;
	color?: string;
	fillcolor?: string;
	geodesic?: boolean;
};

export type StaticMapStyle = {
	feature?: string;
	element?: string;
	rules: Record<string, string | number | boolean>;
};

export type StaticMapRequest = {
	baseUrl?: string;
	center?: Location;
	zoom?: number;
	size?: string | { width: number; height: number };
	scale?: number;
	format?: StaticMapFormat;
	maptype?: StaticMapType;
	language?: string;
	region?: string;
	markers?: StaticMapMarker[];
	paths?: StaticMapPath[];
	visible?: Location[];
	styles?: StaticMapStyle[];
	key?: string;
	signature?: string;
	mapId?: string;
	channel?: string;
	client?: string;
};

const DEFAULT_BASE_URL = "https://maps.googleapis.com/maps/api/staticmap";

const formatLocation = (location: Location): string => {
	if (typeof location === "string") {
		return location;
	}
	return `${location.lat},${location.lng}`;
};

const formatSize = (
	size?: string | { width: number; height: number },
): string | undefined => {
	if (!size) {
		return undefined;
	}
	if (typeof size === "string") {
		return size;
	}
	return `${size.width}x${size.height}`;
};

const buildMarkerParam = (marker: StaticMapMarker): string => {
	const parts: string[] = [];
	if (marker.size) {
		parts.push(`size:${marker.size}`);
	}
	if (marker.color) {
		parts.push(`color:${marker.color}`);
	}
	if (marker.label) {
		parts.push(`label:${marker.label}`);
	}
	if (marker.icon) {
		parts.push(`icon:${marker.icon}`);
	}
	if (marker.anchor) {
		parts.push(`anchor:${marker.anchor}`);
	}
	if (marker.scale !== undefined) {
		parts.push(`scale:${marker.scale}`);
	}
	parts.push(formatLocation(marker.location));
	return parts.join("|");
};

const buildPathParam = (path: StaticMapPath): string => {
	const parts: string[] = [];
	if (path.weight !== undefined) {
		parts.push(`weight:${path.weight}`);
	}
	if (path.color) {
		parts.push(`color:${path.color}`);
	}
	if (path.fillcolor) {
		parts.push(`fillcolor:${path.fillcolor}`);
	}
	if (path.geodesic !== undefined) {
		parts.push(`geodesic:${path.geodesic ? "true" : "false"}`);
	}
	if (path.encodedPath) {
		parts.push(`enc:${path.encodedPath}`);
	} else if (path.points && path.points.length > 0) {
		parts.push(...path.points.map(formatLocation));
	}
	return parts.join("|");
};

const buildStyleParam = (style: StaticMapStyle): string => {
	const parts: string[] = [];
	if (style.feature) {
		parts.push(`feature:${style.feature}`);
	}
	if (style.element) {
		parts.push(`element:${style.element}`);
	}
	for (const [key, value] of Object.entries(style.rules)) {
		parts.push(`${key}:${String(value)}`);
	}
	return parts.join("|");
};

export const buildStaticMapUrl = (request: StaticMapRequest): string => {
	const url = new URL(request.baseUrl ?? DEFAULT_BASE_URL);

	if (request.center) {
		url.searchParams.set("center", formatLocation(request.center));
	}
	if (request.zoom !== undefined) {
		url.searchParams.set("zoom", request.zoom.toString());
	}

	const size = formatSize(request.size);
	if (size) {
		url.searchParams.set("size", size);
	}
	if (request.scale !== undefined) {
		url.searchParams.set("scale", request.scale.toString());
	}
	if (request.format) {
		url.searchParams.set("format", request.format);
	}
	if (request.maptype) {
		url.searchParams.set("maptype", request.maptype);
	}
	if (request.language) {
		url.searchParams.set("language", request.language);
	}
	if (request.region) {
		url.searchParams.set("region", request.region);
	}
	if (request.mapId) {
		url.searchParams.set("map_id", request.mapId);
	}
	if (request.channel) {
		url.searchParams.set("channel", request.channel);
	}
	if (request.client) {
		url.searchParams.set("client", request.client);
	}
	if (request.key) {
		url.searchParams.set("key", request.key);
	}
	if (request.signature) {
		url.searchParams.set("signature", request.signature);
	}

	if (request.visible && request.visible.length > 0) {
		url.searchParams.set(
			"visible",
			request.visible.map(formatLocation).join("|"),
		);
	}

	if (request.markers) {
		for (const marker of request.markers) {
			url.searchParams.append("markers", buildMarkerParam(marker));
		}
	}

	if (request.paths) {
		for (const path of request.paths) {
			const pathParam = buildPathParam(path);
			if (pathParam) {
				url.searchParams.append("path", pathParam);
			}
		}
	}

	if (request.styles) {
		for (const style of request.styles) {
			const styleParam = buildStyleParam(style);
			if (styleParam) {
				url.searchParams.append("style", styleParam);
			}
		}
	}

	return url.toString();
};

export class StaticMapUrlBuilder {
	private request: StaticMapRequest;

	constructor(initial?: StaticMapRequest) {
		this.request = { ...initial };
	}

	setBaseUrl(baseUrl: string): this {
		this.request.baseUrl = baseUrl;
		return this;
	}

	setCenter(center: Location): this {
		this.request.center = center;
		return this;
	}

	setZoom(zoom: number): this {
		this.request.zoom = zoom;
		return this;
	}

	setSize(size: string | { width: number; height: number }): this {
		this.request.size = size;
		return this;
	}

	setScale(scale: number): this {
		this.request.scale = scale;
		return this;
	}

	setFormat(format: StaticMapFormat): this {
		this.request.format = format;
		return this;
	}

	setMapType(maptype: StaticMapType): this {
		this.request.maptype = maptype;
		return this;
	}

	setLanguage(language: string): this {
		this.request.language = language;
		return this;
	}

	setRegion(region: string): this {
		this.request.region = region;
		return this;
	}

	setMapId(mapId: string): this {
		this.request.mapId = mapId;
		return this;
	}

	setChannel(channel: string): this {
		this.request.channel = channel;
		return this;
	}

	setClient(client: string): this {
		this.request.client = client;
		return this;
	}

	setKey(key: string): this {
		this.request.key = key;
		return this;
	}

	setSignature(signature: string): this {
		this.request.signature = signature;
		return this;
	}

	setVisible(locations: Location[]): this {
		this.request.visible = locations;
		return this;
	}

	addMarker(marker: StaticMapMarker): this {
		if (!this.request.markers) {
			this.request.markers = [];
		}
		this.request.markers.push(marker);
		return this;
	}

	addPath(path: StaticMapPath): this {
		if (!this.request.paths) {
			this.request.paths = [];
		}
		this.request.paths.push(path);
		return this;
	}

	addStyle(style: StaticMapStyle): this {
		if (!this.request.styles) {
			this.request.styles = [];
		}
		this.request.styles.push(style);
		return this;
	}

	build(): string {
		return buildStaticMapUrl(this.request);
	}

	toString(): string {
		return this.build();
	}

	async toBlob(): Promise<Blob> {
		const url = this.build();
		const response = await ky.get(url);
		return await response.blob();
	}

	async toArrayBuffer(): Promise<ArrayBuffer> {
		const url = this.build();
		const response = await ky.get(url);
		return await response.arrayBuffer();
	}

	async toBuffer(): Promise<Buffer> {
		const arrayBuffer = await this.toArrayBuffer();
		return Buffer.from(arrayBuffer);
	}

	async toSharp(): Promise<sharp.Sharp> {
		const buffer = await this.toBuffer();
		return sharp(buffer);
	}
}

export const createStaticMapUrlBuilder = (
	initial?: StaticMapRequest,
): StaticMapUrlBuilder => new StaticMapUrlBuilder(initial);
