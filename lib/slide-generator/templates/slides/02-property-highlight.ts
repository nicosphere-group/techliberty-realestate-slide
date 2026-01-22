/**
 * 2. Property Highlight（物件ハイライト）テンプレート
 */

import type { PropertyHighlightContent } from "../../schemas/slide-content";
import { SLIDE_CONTAINER_CLASS, escapeHtml, NUMBER_FONT_STYLE } from "../design-system";

/**
 * 固定カテゴリ（Location, Quality, Price）の定義
 */
const CATEGORIES = [
  { key: "location" as const, label: "LOCATION", title: "立地・アクセス" },
  { key: "quality" as const, label: "QUALITY", title: "品質・特徴" },
  { key: "price" as const, label: "PRICE", title: "価格・価値" },
] as const;

export function renderPropertyHighlightSlide(
  content: PropertyHighlightContent,
): string {
  // 固定3カテゴリのHTML生成
  const columnsHtml = CATEGORIES
    .map((category) => {
      const section = content[category.key];
      const itemsHtml = section.items
        .map((item) => {
          // 数値や強調したい値がある場合（スペック情報など）
          if (item.value) {
            // 数字部分だけにMeiryoを適用
            const valueWithNumberFont = escapeHtml(item.value).replace(/(\d+(?:[.,]\d+)?)/g, '<span style="' + NUMBER_FONT_STYLE + '">$1</span>');
            return `<li class="flex flex-col gap-2 border-b border-[#E2E8F0] pb-5 last:border-0">
              <span class="text-[#1A202C] font-serif font-bold text-[48px] leading-[1.1] tracking-tight">${valueWithNumberFont}</span>
              <span class="text-[18px] text-[#718096] font-sans font-normal">${escapeHtml(item.text)}</span>
            </li>`;
          }
          // テキストのみのリスト（特徴など）
          return `<li class="flex items-start gap-3 border-b border-[#E2E8F0] pb-4 last:border-0">
            <div class="w-[8px] h-[8px] bg-[#C5A059] mt-[10px] flex-shrink-0 rounded-full"></div>
            <span class="text-[20px] text-[#2D3748] leading-[1.5] font-normal">${escapeHtml(item.text)}</span>
          </li>`;
        })
        .join("\n");

      // デザイン：白背景のパネルスタイル、上部にゴールドのアクセントライン
      return `<div class="bg-white border border-[#E2E8F0] p-10 flex flex-col h-full relative">
        <div class="absolute top-0 left-0 w-full h-[4px] bg-[#C5A059]"></div>

        <div class="mb-7">
          <h3 class="text-[20px] font-sans font-bold uppercase tracking-[0.15em] text-[#C5A059] mb-5">${category.label}</h3>
          <h2 class="text-[32px] font-serif font-bold leading-[1.3] text-[#1A202C]">
            ${escapeHtml(section.title)}
          </h2>
        </div>

        <p class="text-[17px] font-sans text-[#718096] leading-[1.7] mb-8 border-l-2 border-[#E2E8F0] pl-5">
          ${escapeHtml(section.description)}
        </p>

        <ul class="flex-1 space-y-6 pt-4 border-t border-[#E2E8F0]">
          ${itemsHtml}
        </ul>
      </div>`;
    })
    .join("\n");

  return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">
  
  <div class="absolute top-0 left-[33.33%] w-[1px] h-full bg-[#C5A059] opacity-[0.05] pointer-events-none"></div>
  <div class="absolute top-0 left-[66.66%] w-[1px] h-full bg-[#C5A059] opacity-[0.05] pointer-events-none"></div>

  <header class="flex-shrink-0 mb-10 flex justify-between items-end relative z-10">
    <div>
      <div class="flex items-center gap-4 mb-5">
        <div class="h-[2px] w-12 bg-[#C5A059]"></div>
        <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Feature Overview</span>
      </div>
      <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
        物件のハイライト
      </h1>
    </div>
    
    ${
      content.propertyName
        ? `<div class="text-right hidden md:block">
            <div class="text-[14px] font-sans font-bold tracking-[0.2em] text-[#A0AEC0] uppercase mb-2">Building</div>
            <div class="text-[20px] font-serif font-medium text-[#4A5568] border-b-2 border-[#C5A059] pb-2 inline-block">
              ${escapeHtml(content.propertyName)}
            </div>
          </div>`
        : ""
    }
  </header>

  <main class="flex-1 min-h-0 relative z-10">
    <div class="grid grid-cols-3 gap-10 h-full">
      ${columnsHtml}
    </div>
  </main>
</div>`;
}