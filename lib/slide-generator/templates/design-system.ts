/**
 * 固定デザインシステム
 *
 * 全スライドで統一されたデザインを提供
 * LLMによる動的生成を廃止し、一貫したブランド体験を実現
 */

/**
 * カラーパレット定義
 */
export interface ColorPalette {
	primary: string;
	secondary: string;
	accent: string;
	background: string;
	surface: string;
	text: string;
}

/**
 * タイポグラフィ定義
 */
export interface Typography {
	fontFamily: string;
	numberFontFamily: string; // 数字専用フォント（メイリオ）
}

/**
 * デザインシステム全体の型
 */
export interface FixedDesignSystem {
	colorPalette: ColorPalette;
	typography: Typography;
}

/**
 * 固定デザインシステム（全スライド共通）
 */
export const FIXED_DESIGN_SYSTEM: FixedDesignSystem = {
	colorPalette: {
		primary: "#1A202C",
		secondary: "#C5A059", // gold
		accent: "#E2E8F0",
		background: "#FDFCFB",
		surface: "#FFFFFF",
		text: "#2D3748",
	},
	typography: {
		fontFamily: "'Noto Serif JP', 'Playfair Display', serif",
		numberFontFamily: "'Meiryo', 'メイリオ', 'Hiragino Sans', sans-serif",
	},
};

/**
 * CSS変数として出力するためのテーマCSS
 */
export function generateThemeCss(
	designSystem: FixedDesignSystem = FIXED_DESIGN_SYSTEM,
): string {
	return `@theme {
    --color-primary: ${designSystem.colorPalette.primary};
    --color-secondary: ${designSystem.colorPalette.secondary};
    --color-accent: ${designSystem.colorPalette.accent};
    --color-background: ${designSystem.colorPalette.background};
    --color-surface: ${designSystem.colorPalette.surface};
    --color-text: ${designSystem.colorPalette.text};
    --font-sans: ${designSystem.typography.fontFamily};
    --font-number: ${designSystem.typography.numberFontFamily};
  }`;
}

/**
 * 完全なHTMLドキュメントを生成（新テンプレート用）
 */
export function wrapInHtmlDocument(bodyContent: string): string {
	const themeCss = generateThemeCss();

	return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
      ${themeCss}
    </style>
  </head>
  <body>
    ${bodyContent}
  </body>
</html>`;
}

// ========================================
// 共通スタイル定数
// ========================================

/**
 * スライドコンテナの共通クラス
 */
export const SLIDE_CONTAINER_CLASS =
	"w-[1920px] h-[1080px] max-h-[1080px] min-h-[1080px] overflow-hidden relative flex flex-col";

/**
 * 背景スタイル
 */
export const SLIDE_BG_CLASS = `bg-[${FIXED_DESIGN_SYSTEM.colorPalette.background}] text-[${FIXED_DESIGN_SYSTEM.colorPalette.text}]`;

/**
 * H1タイトルスタイル
 */
export const H1_CLASS =
	"text-[84px] font-serif font-bold leading-[1.1] tracking-tighter text-[#1A202C] border-l-[12px] border-[#C5A059] pl-10 line-clamp-1";

/**
 * H2サブタイトルスタイル
 */
export const H2_CLASS =
	"text-[56px] font-serif font-medium tracking-wide text-[#1A202C] flex items-center gap-6 after:content-[''] after:flex-1 after:h-[1px] after:bg-[#C5A059] line-clamp-1";

/**
 * H3セクションタイトルスタイル
 */
export const H3_CLASS =
	"text-[32px] font-sans font-bold uppercase tracking-[0.2em] text-[#C5A059] mb-4 line-clamp-1";

/**
 * 本文スタイル
 */
export const BODY_CLASS =
	"text-[26px] font-sans font-normal leading-[1.8] text-[#4A5568] tracking-normal";

/**
 * ラベルスタイル（小見出し/カテゴリ）
 */
export const LABEL_CLASS =
	"text-[18px] font-sans font-light tracking-widest text-[#718096] uppercase";

/**
 * 数字用フォントファミリー（メイリオ）
 * インラインスタイルとして使用: style="${NUMBER_FONT_STYLE}"
 */
export const NUMBER_FONT_STYLE = `font-family: ${FIXED_DESIGN_SYSTEM.typography.numberFontFamily};`;

/**
 * カードスタイル
 */
export const CARD_CLASS =
	"bg-white border border-[#E2E8F0] shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-none";

/**
 * ダークカードスタイル（フォーカス用）
 */
export const DARK_CARD_CLASS = "bg-[#1A202C] text-white";

/**
 * HTMLエスケープ
 */
export function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;",
	};
	return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
}
