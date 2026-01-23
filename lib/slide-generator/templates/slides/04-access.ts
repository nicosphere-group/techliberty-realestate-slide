/**
 * 4. Access（交通アクセス）テンプレート
 */

import type { AccessContent } from "../../schemas/slide-content";
import { SLIDE_CONTAINER_CLASS, escapeHtml, NUMBER_FONT_STYLE } from "../design-system";

export function renderAccessSlide(content: AccessContent): string {
  // 駅リストの生成
  const stationsHtml = content.stations
    .map(
      (station) => `<li class="flex items-end justify-between border-b border-[#E2E8F0] pb-6">
      <div class="flex flex-col gap-2">
        <span class="text-[14px] font-sans font-bold tracking-[0.2em] text-[#718096] uppercase">
          ${escapeHtml(station.lines)}
        </span>
        <span class="text-[40px] font-serif font-medium text-[#1A202C]">
          ${escapeHtml(station.stationName)}
        </span>
      </div>
      
      <div class="flex items-baseline gap-3 mb-2">
        <span class="text-[14px] font-sans font-bold tracking-[0.2em] text-[#A0AEC0] uppercase mr-2">Walk</span>
        <span class="text-[80px] font-serif font-bold text-[#1A202C] leading-[0.8] tracking-tighter" style="${NUMBER_FONT_STYLE}">
          ${station.walkMinutes}
        </span>
        <span class="text-[20px] font-sans font-medium text-[#718096]">min</span>
      </div>
    </li>`,
    )
    .join("\n");

  return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <header class="flex-shrink-0 mb-10 relative z-10">
    <div class="flex items-center gap-4 mb-5">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Location & Access</span>
    </div>
    <div class="flex justify-between items-end">
      <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
        交通アクセス
      </h1>
      <div class="hidden md:block text-right pb-2">
        <div class="flex items-center justify-end gap-3 text-[#4A5568]">
          <svg class="w-6 h-6 text-[#C5A059]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span class="text-[18px] font-sans font-medium tracking-wide">${escapeHtml(content.address)}</span>
        </div>
      </div>
    </div>
  </header>

  <main class="flex-1 min-h-0 flex gap-20 relative z-10">
    
    <div class="w-[40%] flex flex-col h-full gap-8">
      <div class="flex-1 bg-[#EDF2F7] relative border border-[#E2E8F0] overflow-hidden group">
        ${
          content.imageUrl
            ? `<img src="${escapeHtml(content.imageUrl)}" class="w-full h-full object-cover opacity-90 grayscale-[0.2]" alt="Map" />`
            : `<div class="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                 <div class="w-[1px] h-full bg-[#CBD5E0] absolute left-1/2 transform -translate-x-1/2"></div>
                 <div class="h-[1px] w-full bg-[#CBD5E0] absolute top-1/2 transform -translate-y-1/2"></div>
                 <div class="w-40 h-40 border border-[#CBD5E0] rounded-full flex items-center justify-center">
                   <div class="w-3 h-3 bg-[#A0AEC0] rounded-full"></div>
                 </div>
                 <span class="absolute bottom-6 right-6 text-[14px] font-sans font-bold tracking-widest text-[#718096]">MAP AREA</span>
               </div>`
        }
        
        <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1A202C] text-white px-6 py-4 shadow-xl">
          <div class="text-[14px] font-sans font-bold tracking-widest uppercase mb-2 text-[#C5A059]">Subject Property</div>
          <div class="text-[20px] font-serif font-medium whitespace-nowrap">${escapeHtml(content.propertyName)}</div>
          <div class="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-[#1A202C]"></div>
        </div>
      </div>

      ${
        content.description
          ? `<div class="bg-white border-l-3 border-[#C5A059] p-8 shadow-sm">
          <p class="text-[18px] font-sans leading-[1.8] text-[#4A5568] text-justify">
            ${escapeHtml(content.description)}
          </p>
        </div>`
          : ""
      }
    </div>

    <div class="flex-1 flex flex-col justify-center">
      <div class="mb-10">
        <h3 class="text-[24px] font-sans font-light tracking-[0.1em] text-[#4A5568] mb-3">
          Transportation
        </h3>
        <p class="text-[18px] text-[#A0AEC0] font-sans">
          主要エリアへの快適なアクセス環境
        </p>
      </div>

      <ul class="flex flex-col gap-8">
        ${stationsHtml}
      </ul>

      <div class="mt-14 pt-8 border-t border-[#E2E8F0] flex items-center gap-5 opacity-60">
        <svg class="w-6 h-6 text-[#A0AEC0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-[14px] text-[#718096] font-sans">
          ※所要時間は徒歩1分＝80mとして算出したもので、信号待ち時間は含まれておりません。
        </p>
      </div>
    </div>

  </main>
</div>`;
}