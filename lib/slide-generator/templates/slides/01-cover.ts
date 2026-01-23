/**
 * 1. Cover（表紙）テンプレート
 */

import type { CoverContent } from "../../schemas/slide-content";
import {
  SLIDE_CONTAINER_CLASS,
  escapeHtml,
  NUMBER_FONT_STYLE,
} from "../design-system";

/**
 * 本日の日付を YYYY.MM.DD 形式で取得
 */
function getTodayFormatted(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function renderCoverSlide(content: CoverContent): string {
  // 画像セクション（3:4の縦長画像を想定）
  // 画面比率16:9に対し、3:4の画像は横幅の約42%を占めます。
  // そのため、右側45%程度を確保し、object-coverで配置すればほぼトリミングなしで収まります。
  const imageSection = content.imageUrl ? `
    <div class="absolute top-0 right-0 w-[45%] h-full overflow-hidden z-0">
      <img
        src="${escapeHtml(content.imageUrl)}"
        alt="Property Image"
        class="w-full h-full object-cover object-center"
      />
      <div class="absolute inset-0 bg-gradient-to-r from-[#FDFCFB] via-[#FDFCFB]/40 to-transparent"></div>
      <div class="absolute bottom-4 right-4 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded">
        <span class="text-[11px] font-sans text-white/80">※AIにより生成された画像です</span>
      </div>
    </div>
  ` : ``;

  return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#1A202C] px-20 py-14 flex flex-col justify-between relative overflow-hidden" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  ${imageSection}

  <header class="relative z-10 mt-4 max-w-[55%]">
    <div class="flex items-center gap-5 mb-10">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[18px] font-sans font-bold uppercase tracking-[0.3em] text-[#C5A059]">Presentation Proposal</span>
    </div>
    
    <h1 class="text-[108px] font-serif font-bold leading-[1.05] tracking-tight text-[#1A202C] mb-10 break-words line-clamp-3">
      ${escapeHtml(content.propertyName)}
    </h1>
    
    ${content.address ? `
    <div class="flex items-start gap-4 pl-1 group">
      <svg class="w-8 h-8 text-[#C5A059] mt-[3px] opacity-80 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      <p class="text-[28px] font-sans font-light text-[#4A5568] tracking-wide">
        ${escapeHtml(content.address)}
      </p>
    </div>` : ""}
  </header>

  <div class="flex-1 flex items-center py-10 relative z-10 max-w-[55%]">
  </div>

  <footer class="relative z-10 border-t border-[#E2E8F0] pt-10 max-w-[55%]">
    <div class="flex justify-between items-end">

      <div class="flex flex-col gap-4">
        <div class="text-[14px] font-sans font-bold tracking-[0.25em] text-[#C5A059] uppercase">Provided By</div>
        <div class="space-y-2">
          <div class="text-[42px] font-serif font-bold text-[#1A202C] leading-tight">${escapeHtml(content.companyName)}</div>
          ${content.storeName ? `<div class="text-[28px] font-sans text-[#4A5568] font-medium">${escapeHtml(content.storeName)}</div>` : ""}
          ${content.storeAddress ? `<div class="text-[18px] font-sans text-[#718096] leading-relaxed">${escapeHtml(content.storeAddress)}</div>` : ""}
          <div class="flex gap-6 text-[16px] font-sans text-[#718096] mt-3">
            ${content.storePhoneNumber ? `<div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-[#C5A059]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              <span>${escapeHtml(content.storePhoneNumber)}</span>
            </div>` : ""}
            ${content.storeEmailAddress ? `<div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-[#C5A059]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              <span>${escapeHtml(content.storeEmailAddress)}</span>
            </div>` : ""}
          </div>
        </div>
      </div>

      <div class="text-right">
        <div class="text-[14px] font-sans font-bold tracking-[0.25em] text-[#A0AEC0] uppercase mb-2">Issue Date</div>
        <div class="text-[26px] font-sans font-medium text-[#4A5568] tracking-widest" style="${NUMBER_FONT_STYLE}">
          ${getTodayFormatted()}
        </div>
      </div>
      
    </div>
  </footer>
</div>`;
}