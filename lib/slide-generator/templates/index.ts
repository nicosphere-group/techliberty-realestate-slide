/**
 * テンプレートレジストリ
 *
 * スライドタイプベースのレンダリング関数をエクスポート
 */

// スライドテンプレートのエクスポート
export * from "./slides";
export {
	wrapInHtmlDocument,
	FIXED_DESIGN_SYSTEM,
	generateThemeCss,
	SLIDE_CONTAINER_CLASS,
	escapeHtml,
} from "./design-system";
export type { FixedDesignSystem, ColorPalette, Typography } from "./design-system";

// スライドコンテンツスキーマの再エクスポート
export * from "../schemas/slide-content";

// スライドタイプの再エクスポート
export * from "../types/slide-types";

import type { SlideType } from "../types/slide-types";
import type { SlideContentMap } from "../schemas/slide-content";
import {
	renderSlideBody,
	dynamicSlideRenderers,
	STATIC_SLIDE_TYPES,
} from "./slides";
import { wrapInHtmlDocument } from "./design-system";

/**
 * スライドタイプとコンテンツから完全なHTMLドキュメントを生成
 */
export function renderSlideHtml<T extends SlideType>(
	slideType: T,
	content: SlideContentMap[T],
): string {
	const bodyContent = renderSlideBody(slideType, content);
	return wrapInHtmlDocument(bodyContent);
}

/**
 * スライドタイプが有効かどうかを確認
 */
export function isValidSlideType(type: string): type is SlideType {
	const allSlideTypes = [
		...Object.keys(dynamicSlideRenderers),
		...STATIC_SLIDE_TYPES,
	];
	return allSlideTypes.includes(type);
}

/**
 * 利用可能なスライドタイプの一覧
 */
export const availableSlideTypes: SlideType[] = [
	...Object.keys(dynamicSlideRenderers),
	...STATIC_SLIDE_TYPES,
] as SlideType[];
