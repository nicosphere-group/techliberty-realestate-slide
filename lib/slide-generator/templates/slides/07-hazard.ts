/**
 * 7. Hazard（災害リスク）テンプレート - Refined Layout
 * 徒歩表記の日本語化、余白の拡大、出典位置の最適化
 */

import type { HazardContent } from "../../schemas/slide-content";
import {
	escapeHtml,
	NUMBER_FONT_STYLE,
	SLIDE_CONTAINER_CLASS,
} from "../design-system";

export function renderHazardSlide(content: HazardContent): string {
	// 下部情報エリアの高さを定義（以前より広げて余白を確保）
	const INFO_AREA_HEIGHT = "h-[165px]";

	return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-[#F7F5F2] text-[#2D3748] px-20 py-12 flex flex-col overflow-hidden relative" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <header class="flex-shrink-0 mb-8 relative z-10">
    <div class="flex items-center gap-4 mb-3">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Security & Safety</span>
    </div>
    <h1 class="text-[56px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
      災害リスク・ハザードマップ
    </h1>
  </header>

  <main class="flex-1 min-h-0 grid grid-cols-2 gap-12 relative z-10 pb-2">

    <section class="flex flex-col h-full overflow-hidden">
      
      <div class="flex-1 relative min-h-0 border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        ${
					content.hazardMapUrl
						? `<img src="${escapeHtml(content.hazardMapUrl)}" class="absolute inset-0 w-full h-full object-cover" alt="Hazard Map">`
						: `<div class="absolute inset-0 flex items-center justify-center text-[#A0AEC0] font-sans tracking-widest text-xl bg-[#EDF2F7]">HAZARD MAP</div>`
				}
        <div class="absolute top-0 left-0 bg-[#1A202C] text-white px-6 py-3 z-20">
          <span class="text-[13px] font-sans font-bold tracking-[0.2em] uppercase">Hazard Map</span>
        </div>
      </div>

      <div class="${INFO_AREA_HEIGHT} flex-shrink-0 pt-6 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4 border-b border-[#CBD5E0] pb-2">
            <h3 class="text-[18px] font-serif font-bold text-[#1A202C] flex items-center gap-3">
              <span class="w-1.5 h-5 bg-[#1A202C]"></span>
              災害リスク凡例
            </h3>
            <span class="text-[11px] text-gray-500 font-sans">※想定最大規模</span>
          </div>

          <div class="grid grid-cols-2 gap-x-6 gap-y-3">
            <div class="flex items-center gap-3">
              <div class="w-4 h-4 bg-[#60A5FA] flex-shrink-0 border border-black/10"></div>
              <span class="text-[14px] font-medium text-gray-700">洪水浸水想定区域</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-4 h-4 bg-[#F97316] flex-shrink-0 border border-black/10"></div>
              <span class="text-[14px] font-medium text-gray-700">土石流警戒区域</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-4 h-4 bg-[#EAB308] flex-shrink-0 border border-black/10"></div>
              <span class="text-[14px] font-medium text-gray-700">急傾斜地崩壊警戒区域</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-4 h-4 bg-[#EF4444] flex-shrink-0 border border-black/10"></div>
              <span class="text-[14px] font-medium text-gray-700">地すべり警戒区域</span>
            </div>
          </div>
        </div>
        
        <div class="text-right mt-auto">
           <span class="text-[10px] text-gray-400 font-sans tracking-wide">出典：国土交通省ハザードマップポータルサイト</span>
        </div>
      </div>
    </section>

    <section class="flex flex-col h-full overflow-hidden">
      
      <div class="flex-1 relative min-h-0 border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        ${
					content.shelterMapUrl
						? `<img src="${escapeHtml(content.shelterMapUrl)}" class="absolute inset-0 w-full h-full object-cover object-center" alt="Shelter Map">`
						: `<div class="absolute inset-0 flex items-center justify-center text-[#A0AEC0] font-sans tracking-widest text-xl bg-[#EDF2F7]">SHELTER MAP</div>`
				}
        <div class="absolute top-0 left-0 bg-[#C5A059] text-white px-6 py-3 z-20">
          <span class="text-[13px] font-sans font-bold tracking-[0.2em] uppercase">Evacuation</span>
        </div>
      </div>

      <div class="${INFO_AREA_HEIGHT} flex-shrink-0 pt-6 flex flex-col justify-between">
        <div>
          <div class="flex items-end justify-between mb-5 border-b border-[#CBD5E0] pb-2">
            <h3 class="text-[18px] font-serif font-bold text-[#1A202C] flex items-center gap-3">
              <span class="w-1.5 h-5 bg-[#C5A059]"></span>
              最寄りの避難所
            </h3>
            <span class="text-[11px] text-gray-500 font-sans">80m/1分換算</span>
          </div>

          ${
						content.shelters && content.shelters.length > 0
							? `<div class="grid grid-cols-3 gap-8">
                  ${content.shelters
										.slice(0, 3)
										.map((shelter, index) => {
											// 距離文字列から数字だけを抽出して強調表示するための処理
											// 例: "徒歩約9分" -> "徒歩" + "9"(大) + "分"
											const distanceText =
												shelter.distance.replace(/[^\d]/g, "") || // 数字以外を除去
												"0"; // 数字がなければ0

											return `
                  <div class="flex flex-col">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="flex items-center justify-center w-5 h-5 rounded-full bg-[#48BB78] text-[12px] font-bold text-white font-sans flex-shrink-0" style="${NUMBER_FONT_STYLE}">${index + 1}</span>
                      <span class="text-[13px] font-bold text-[#48BB78] font-sans flex items-baseline gap-[1px]">
                        徒歩
                        <span class="text-[20px] leading-none mx-0.5" style="${NUMBER_FONT_STYLE}">${distanceText}</span>
                        分
                      </span>
                    </div>
                    <div class="text-[15px] font-serif font-bold text-[#1A202C] leading-tight mb-1.5 truncate">
                      ${escapeHtml(shelter.name)}
                    </div>
                    <div class="text-[11px] text-gray-500 leading-tight truncate">
                      ${escapeHtml(shelter.type || "指定緊急避難場所")}
                    </div>
                  </div>
                `;
										})
										.join("")}
                </div>`
							: `<div class="flex items-center justify-center h-[60px] text-[13px] text-gray-400 bg-gray-50 rounded">避難所情報なし</div>`
					}
        </div>

        <div class="text-right mt-3 pt-2">
          <span class="text-[11px] text-gray-400 font-sans tracking-wide leading-relaxed">出典：国土交通省 不動産情報ライブラリ</span>
        </div>

      </div>
    </section>

  </main>
</div>`;
}
