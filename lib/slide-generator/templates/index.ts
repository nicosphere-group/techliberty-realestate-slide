/**
 * テンプレートレジストリ
 *
 * スライドタイプベースのレンダリング関数をエクスポート
 */

// スライドコンテンツスキーマの再エクスポート
export * from "../schemas/slide-content";
// スライドタイプの再エクスポート
export * from "../types/slide-types";
export type {
	ColorPalette,
	FixedDesignSystem,
	Typography,
} from "./design-system";
export {
	escapeHtml,
	FIXED_DESIGN_SYSTEM,
	generateThemeCss,
	SLIDE_CONTAINER_CLASS,
	wrapInHtmlDocument,
} from "./design-system";
// スライドテンプレートのエクスポート
export * from "./slides";

import type { SlideContentMap } from "../schemas/slide-content";
import type { SlideType } from "../types/slide-types";
import { wrapInHtmlDocument } from "./design-system";
import {
	dynamicSlideRenderers,
	renderSlideBody,
	STATIC_SLIDE_TYPES,
} from "./slides";

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
