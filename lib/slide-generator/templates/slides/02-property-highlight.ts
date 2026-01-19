/**
 * 2. Property Highlight（物件ハイライト）テンプレート
 */

import type { PropertyHighlightContent } from "../../schemas/slide-content";
import { SLIDE_CONTAINER_CLASS, escapeHtml } from "../design-system";

export function renderPropertyHighlightSlide(
  content: PropertyHighlightContent,
): string {
  // カラムごとのHTML生成
  const columnsHtml = content.columns
    .map((column, index) => {
      const itemsHtml = column.items
        .map((item) => {
          // 数値や強調したい値がある場合（スペック情報など）
          if (item.value) {
            return `<li class="flex flex-col gap-2 border-b border-[#E2E8F0] pb-4 last:border-0">
              <span class="text-[#C5A059] font-serif font-bold text-[40px] leading-none">${escapeHtml(item.value)}</span>
              <span class="text-[20px] text-[#4A5568] font-sans font-medium">${escapeHtml(item.text)}</span>
            </li>`;
          }
          // テキストのみのリスト（特徴など）
          return `<li class="flex items-start gap-4 border-b border-[#E2E8F0] pb-4 last:border-0">
            <div class="w-[14px] h-[2px] bg-[#C5A059] mt-[14px] flex-shrink-0"></div>
            <span class="text-[22px] text-[#2D3748] leading-[1.6]">${escapeHtml(item.text)}</span>
          </li>`;
        })
        .join("\n");

      // デザイン：白背景のパネルスタイル、上部にゴールドのアクセントライン
      return `<div class="bg-white/80 backdrop-blur-sm border border-[#E2E8F0] p-10 flex flex-col h-full relative group">
        <div class="absolute top-0 left-0 w-full h-[4px] bg-[#C5A059]"></div>
        
        <div class="mb-8">
          <h3 class="text-[14px] font-sans font-bold uppercase tracking-[0.2em] text-[#A0AEC0] mb-4">${escapeHtml(column.category)}</h3>
          <h2 class="text-[34px] font-serif font-medium leading-[1.3] text-[#1A202C]">
            ${escapeHtml(column.title)}
          </h2>
        </div>
        
        <p class="text-[18px] font-sans text-[#718096] leading-[1.8] mb-10 border-l-2 border-[#E2E8F0] pl-5">
          ${escapeHtml(column.description)}
        </p>
        
        <ul class="flex-1 space-y-5">
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