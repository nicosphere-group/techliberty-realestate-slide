import { createStaticMapUrlBuilder } from "../lib/google-maps-static-api";

const apiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!apiKey) {
	console.error("GOOGLE_MAPS_API_KEY is not set");
	process.exit(1);
}

const url = createStaticMapUrlBuilder()
	.setCenter({ lat: 35.681236, lng: 139.767125 })
	.setZoom(15)
	.setSize({ width: 640, height: 640 })
	.setScale(2)
	.setFormat("png")
	.setMapType("roadmap")
	.setLanguage("ja")
	.setRegion("JP")
	.setKey(apiKey)
	.addMarker({
		location: { lat: 35.681236, lng: 139.767125 },
		size: "mid",
		color: "red",
		label: "T",
	})
	.addMarker({
		location: "東京駅",
		size: "small",
		color: "blue",
		label: "S",
	})
	.addPath({
		weight: 5,
		color: "0x0A70FF",
		geodesic: true,
		points: [
			{ lat: 35.681236, lng: 139.767125 },
			{ lat: 35.689487, lng: 139.691706 },
		],
	})
	.addStyle({
		feature: "poi",
		element: "labels",
		rules: { visibility: "off" },
	})
	.build();

console.log(url);
