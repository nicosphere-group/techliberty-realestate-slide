/**
 * 2. Property Highlight（物件ハイライト）テンプレート
 */

import type { PropertyHighlightContent } from "../../schemas/slide-content";
import { SLIDE_CONTAINER_CLASS, escapeHtml, NUMBER_FONT_STYLE } from "../design-system";

/**
 * 固定カテゴリ定義
 */
const CATEGORIES = [
  { key: "location" as const, label: "LOCATION", title: "立地・アクセス" },
  { key: "quality" as const, label: "QUALITY", title: "品質・特徴" },
  { key: "price" as const, label: "PRICE", title: "価格・価値" },
] as const;

export function renderPropertyHighlightSlide(
  content: PropertyHighlightContent,
): string {
  
  const columnsHtml = CATEGORIES
    .map((category) => {
      const section = content[category.key];
      
      // リスト項目の生成
      const itemsHtml = section.items
        .map((item) => {
          // 数値スペック強調パターン（valueに数字が含まれる場合）
          if (item.value && /\d/.test(item.value)) {
            const valueWithStyle = escapeHtml(item.value).replace(
              /(\d+(?:[.,]\d+)?)/g, 
              `<span style="${NUMBER_FONT_STYLE}" class="text-[#C5A059] text-[68px] font-medium">$1</span>`
            );
            
            return `<li class="flex flex-col border-b border-[#E2E8F0] pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
              <div class="font-serif text-[28px] leading-[1.1] tracking-tight text-[#1A202C]">
                ${valueWithStyle}
              </div>
              <span class="text-[20px] text-[#4A5568] font-sans font-bold tracking-wide mt-2 flex items-center gap-2">
                <span class="w-6 h-[2px] bg-[#C5A059]"></span>
                ${escapeHtml(item.text)}
              </span>
            </li>`;
          }
          
          // ラベル付きテキストパターン（valueはあるが数字がない場合）
          if (item.value) {
            return `<li class="flex flex-col border-b border-[#E2E8F0] pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
              <div class="text-[26px] font-serif font-medium text-[#1A202C] mb-1">
                ${escapeHtml(item.value)}
              </div>
              <span class="text-[20px] text-[#4A5568] font-sans font-bold tracking-wide flex items-center gap-2">
                <span class="w-6 h-[2px] bg-[#C5A059]"></span>
                ${escapeHtml(item.text)}
              </span>
            </li>`;
          }
          
          // 通常テキスト（特徴）パターン
          return `<li class="flex items-start gap-3 py-2 border-b border-[#EDF2F7] last:border-0">
            <div class="mt-[10px] flex-shrink-0 text-[#C5A059]">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="0" width="5.65" height="5.65" transform="rotate(45 4 0)" fill="currentColor"/>
              </svg>
            </div>
            <span class="text-[20px] text-[#2D3748] leading-[1.6] font-normal text-justify">
              ${escapeHtml(item.text)}
            </span>
          </li>`;
        })
        .join("\n");

      // カード部分のHTML
      return `<div class="bg-white flex flex-col h-full border border-[#CBD5E0] relative">
        <div class="h-[6px] w-full bg-[#C5A059]"></div>

        <div class="p-8 flex flex-col h-full">
          <div class="mb-5">
            <div class="flex justify-between items-center mb-3">
               <h3 class="text-[16px] font-sans font-bold uppercase tracking-[0.2em] text-[#C5A059] border border-[#C5A059] px-3 py-[3px]">
                 ${category.label}
               </h3>
            </div>
            <h2 class="text-[32px] font-serif font-bold leading-[1.3] text-[#1A202C]">
              ${escapeHtml(section.title)}
            </h2>
          </div>

          <div class="min-h-[5em] mb-6">
            <p class="text-[19px] font-sans text-[#4A5568] leading-[1.8]">
              ${escapeHtml(section.description)}
            </p>
          </div>

          <div class="w-full h-[1px] bg-[#E2E8F0] mb-5"></div>

          <ul class="flex-1 space-y-2">
            ${itemsHtml}
          </ul>
        </div>
      </div>`;
    })
    .join("\n");

  return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-16 py-12 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">
  
  <header class="flex-shrink-0 mb-10 flex justify-between items-end">
    <div>
      <div class="flex items-center gap-4 mb-4">
        <div class="h-[2px] w-12 bg-[#C5A059]"></div>
        <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Feature Overview</span>
      </div>
      <h1 class="text-[64px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
        物件のハイライト
      </h1>
    </div>
    
    ${
      content.propertyName
        ? `<div class="text-right hidden md:block border-l-2 border-[#C5A059] pl-5 py-1">
            <div class="text-[13px] font-sans font-bold tracking-[0.2em] text-[#718096] uppercase mb-1">Building</div>
            <div class="text-[22px] font-serif font-bold text-[#2D3748]">
              ${escapeHtml(content.propertyName)}
            </div>
          </div>`
        : ""
    }
  </header>

  <main class="flex-1 min-h-0">
    <div class="grid grid-cols-3 gap-6 h-full items-stretch">
      ${columnsHtml}
    </div>
  </main>
  
  <div class="absolute bottom-6 right-8 text-[#A0AEC0] text-[12px] font-sans tracking-widest uppercase">
    Highlights & Features
  </div>
</div>`;
}