/**
 * スライドテンプレート エクスポート
 */

export { renderCoverSlide } from "./01-cover";
export { renderPropertyHighlightSlide } from "./02-property-highlight";
export { renderFloorPlanSlide } from "./03-floor-plan";
export { renderAccessSlide } from "./04-access";
export { renderNearbySlide } from "./05-nearby";
export { renderPriceAnalysisSlide } from "./06-price-analysis";
export { renderHazardSlide } from "./07-hazard";
export { renderFundingSlide } from "./08-funding";
export { renderExpensesSlide } from "./09-expenses";
export { renderTaxSlide } from "./10-tax";
export { renderPurchaseFlowSlide } from "./11-purchase-flow";
export { renderFlyerSlide } from "./00-flyer";

import type { SlideContentMap } from "../../schemas/slide-content";
import type { SlideType } from "../../types/slide";
import { renderCoverSlide } from "./01-cover";
import { renderPropertyHighlightSlide } from "./02-property-highlight";
import { renderFloorPlanSlide } from "./03-floor-plan";
import { renderAccessSlide } from "./04-access";
import { renderNearbySlide } from "./05-nearby";
import { renderPriceAnalysisSlide } from "./06-price-analysis";
import { renderHazardSlide } from "./07-hazard";
import { renderFundingSlide } from "./08-funding";
import { renderExpensesSlide } from "./09-expenses";
import { renderTaxSlide } from "./10-tax";
import { renderPurchaseFlowSlide } from "./11-purchase-flow";
import { renderFlyerSlide } from "./00-flyer";

/** 静的テンプレート（LLMによるコンテンツ生成が不要なスライド） */
export const STATIC_SLIDE_TYPES = ["tax", "purchase-flow", "flyer"] as const;
export type StaticSlideType = (typeof STATIC_SLIDE_TYPES)[number];

/** 動的テンプレート（LLMによるコンテンツ生成が必要なスライド） */
export type DynamicSlideType = Exclude<SlideType, StaticSlideType>;

/**
 * スライドタイプが静的テンプレートかどうかを判定
 */
export function isStaticSlideType(
	slideType: SlideType,
): slideType is StaticSlideType {
	return STATIC_SLIDE_TYPES.includes(slideType as StaticSlideType);
}

/**
 * 動的スライドタイプごとのレンダリング関数マップ
 */
export const dynamicSlideRenderers: {
	[K in DynamicSlideType]: (content: SlideContentMap[K]) => string;
} = {
	cover: renderCoverSlide,
	"property-highlight": renderPropertyHighlightSlide,
	"floor-plan": renderFloorPlanSlide,
	access: renderAccessSlide,
	nearby: renderNearbySlide,
	"price-analysis": renderPriceAnalysisSlide,
	hazard: renderHazardSlide,
	funding: renderFundingSlide,
	expenses: renderExpensesSlide,
};

/**
 * 静的スライドのレンダリング関数マップ
 */
export const staticSlideRenderers = {
	tax: renderTaxSlide,
	"purchase-flow": renderPurchaseFlowSlide,
	flyer: renderFlyerSlide,
} as const;

/**
 * 動的スライドタイプとコンテンツからHTMLボディを生成
 */
export function renderDynamicSlideBody<T extends DynamicSlideType>(
	slideType: T,
	content: SlideContentMap[T],
): string {
	const renderer = dynamicSlideRenderers[slideType];
	if (!renderer) {
		throw new Error(`Unknown dynamic slide type: ${slideType}`);
	}
	// biome-ignore lint/suspicious/noExplicitAny: 動的レンダラー選択のため
	return renderer(content as any);
}

/**
 * 静的スライドタイプからHTMLボディを生成
 * - tax, purchase-flow: 引数なし
 * - flyer: imageUrlsを受け取る
 */
export function renderStaticSlideBody(
	slideType: StaticSlideType,
	options?: { imageUrls?: string[] },
): string {
	switch (slideType) {
		case "tax":
			return renderTaxSlide();
		case "purchase-flow":
			return renderPurchaseFlowSlide();
		case "flyer":
			return renderFlyerSlide(options?.imageUrls ?? []);
		default:
			throw new Error(`Unknown static slide type: ${slideType}`);
	}
}

/**
 * 汎用スライドレンダリング関数（後方互換性のため維持）
 */
export function renderSlideBody<T extends SlideType>(
	slideType: T,
	content: SlideContentMap[T],
): string {
	if (isStaticSlideType(slideType)) {
		// 静的スライドの場合
		const flyerContent = content as { imageUrls?: string[] };
		return renderStaticSlideBody(slideType, {
			imageUrls: flyerContent.imageUrls,
		});
	}
	// 動的スライドの場合
	return renderDynamicSlideBody(
		slideType as DynamicSlideType,
		content as SlideContentMap[DynamicSlideType],
	);
}
