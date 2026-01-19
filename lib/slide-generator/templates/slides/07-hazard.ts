/**
 * 7. Hazard（災害リスク）テンプレート - Refined
 * 左：ハザードマップとリスク一覧 / 右：避難所マップと施設一覧
 */

import type { HazardContent } from "../../schemas/slide-content";
import { SLIDE_CONTAINER_CLASS, escapeHtml } from "../design-system";

export function renderHazardSlide(content: HazardContent): string {
  return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">
  
  <div class="absolute top-0 left-1/2 w-[1px] h-full bg-[#E2E8F0] pointer-events-none"></div>

  <header class="flex-shrink-0 mb-10 relative z-10">
    <div class="flex items-center gap-4 mb-5">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Security & Safety</span>
    </div>
    <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
      災害リスク・ハザードマップ
    </h1>
  </header>

  <main class="flex-1 min-h-0 grid grid-cols-2 gap-14 relative z-10">
    
    <section class="h-full bg-white border border-[#E2E8F0] shadow-sm relative overflow-hidden">
      ${
        content.hazardMapUrl
          ? `<img src="${escapeHtml(content.hazardMapUrl)}" class="w-full h-full object-cover" alt="Hazard Map">`
          : `<div class="absolute inset-0 flex items-center justify-center text-[#A0AEC0] font-sans tracking-widest text-xl bg-[#EDF2F7]">HAZARD MAP IMAGE</div>`
      }
      <div class="absolute top-0 left-0 bg-[#1A202C] text-white px-6 py-4">
        <span class="text-[16px] font-sans font-bold tracking-[0.2em] uppercase">Hazard Map</span>
      </div>
      <div class="absolute inset-0 border-[12px] border-white/10 pointer-events-none"></div>
    </section>

    <section class="h-full bg-white border border-[#E2E8F0] shadow-sm relative overflow-hidden">
      ${
        content.shelterMapUrl
          ? `<img src="${escapeHtml(content.shelterMapUrl)}" class="w-full h-full object-cover" alt="Shelter Map">`
          : `<div class="absolute inset-0 flex items-center justify-center text-[#A0AEC0] font-sans tracking-widest text-xl bg-[#EDF2F7]">SHELTER MAP IMAGE</div>`
      }
      <div class="absolute top-0 left-0 bg-[#C5A059] text-white px-6 py-4">
        <span class="text-[16px] font-sans font-bold tracking-[0.2em] uppercase">Evacuation Route</span>
      </div>
      <div class="absolute inset-0 border-[12px] border-white/10 pointer-events-none"></div>
    </section>

  </main>
</div>`;
}