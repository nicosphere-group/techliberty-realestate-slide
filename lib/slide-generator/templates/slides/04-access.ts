/**
 * 4. Access（交通アクセス）テンプレート
 * 放射状路線図マップ + 所要時間情報を表示
 */

import type { AccessContent } from "../../schemas/slide-content";
import {
	escapeHtml,
	NUMBER_FONT_STYLE,
	SLIDE_CONTAINER_CLASS,
} from "../design-system";

export function renderAccessSlide(content: AccessContent): string {
	// 最寄り駅の路線名をフォーマット
	const linesText = content.nearestStation.lines.join("・");

	// 主要駅への所要時間リスト生成（2列グリッド用）
	const stationRoutesHtml = content.stationRoutes
		.map(
			(route) => `
        <div class="flex items-end justify-between border-b border-[#E2E8F0] pb-5">
          <div class="flex flex-col gap-1.5">
            <span class="text-[14px] font-sans font-bold tracking-[0.05em] text-[#718096]">${escapeHtml(route.routeSummary)}</span>
            <div class="flex items-center gap-2.5">
              <div class="w-3 h-3 rounded-full bg-[#C5A059]"></div>
              <span class="text-[28px] font-serif font-medium text-[#1A202C]">${escapeHtml(route.destination)}駅</span>
            </div>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-[52px] font-serif font-bold text-[#1A202C] leading-[0.8]" style="${NUMBER_FONT_STYLE}">${route.totalMinutes}</span>
            <span class="text-[18px] font-sans font-medium text-[#4A5568]">分</span>
          </div>
        </div>
      `,
		)
		.join("");

	// 空港への所要時間リスト生成（横並び用）
	const airportRoutesHtml = content.airportRoutes
		.map(
			(route) => `
        <div class="flex items-end gap-4">
          <span class="text-[26px] font-serif font-medium text-[#1A202C]">${escapeHtml(route.destination)}</span>
          <div class="flex items-baseline gap-2">
            <span class="text-[52px] font-serif font-bold text-[#1A202C] leading-[0.8]" style="${NUMBER_FONT_STYLE}">${route.totalMinutes}</span>
            <span class="text-[18px] font-sans font-medium text-[#4A5568]">分</span>
          </div>
        </div>
      `,
		)
		.join("");

	return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <header class="flex-shrink-0 mb-10 relative z-10">
    <div class="flex items-center gap-4 mb-5">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Route Map</span>
    </div>
    <div class="flex justify-between items-end">
      <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
        交通アクセス
      </h1>
      <div class="text-right pb-2">
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

  <main class="flex-1 min-h-0 flex gap-16 relative z-10">

    <!-- 左側: 路線図マップ -->
    <div class="w-[45%] flex flex-col h-full">
      <div class="flex-1 relative overflow-hidden flex items-center justify-center">
        ${
					content.mapImageUrl
						? `<img src="${escapeHtml(content.mapImageUrl)}" class="max-w-full max-h-full" alt="Route Map" />`
						: `<div class="flex flex-col items-center justify-center bg-[#EDF2F7] w-full h-full">
                <svg class="w-24 h-24 text-[#CBD5E0] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span class="text-[18px] font-sans text-[#718096]">路線図マップ</span>
              </div>`
				}
      </div>
    </div>

    <!-- 右側: アクセス情報 -->
    <div class="flex-1 flex flex-col justify-between py-2">

      <!-- 最寄り駅セクション -->
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-4">
          <svg class="w-7 h-7 text-[#C5A059]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
          <h3 class="text-[26px] font-sans font-light tracking-[0.1em] text-[#4A5568]">最寄り駅</h3>
        </div>

        <!-- 最寄り駅（大きい表示） -->
        <div class="flex items-end justify-between border-b border-[#E2E8F0] pb-6">
          <div class="flex flex-col gap-2">
            <span class="text-[16px] font-sans font-bold tracking-[0.15em] text-[#4A5568] uppercase">
              ${escapeHtml(linesText)}
            </span>
            <span class="text-[44px] font-serif font-medium text-[#1A202C]">
              ${escapeHtml(content.nearestStation.name)}駅
            </span>
          </div>
          <div class="flex items-baseline gap-3 mb-2">
            <span class="text-[16px] font-sans font-bold tracking-[0.15em] text-[#718096] uppercase mr-2">徒歩</span>
            <span class="text-[84px] font-serif font-bold text-[#1A202C] leading-[0.8] tracking-tighter" style="${NUMBER_FONT_STYLE}">
              ${content.nearestStation.walkMinutes}
            </span>
            <span class="text-[22px] font-sans font-medium text-[#4A5568]">分</span>
          </div>
        </div>
      </div>

      <!-- 主要ターミナル駅へ -->
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-5">
          <svg class="w-7 h-7 text-[#C5A059]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <h3 class="text-[26px] font-sans font-light tracking-[0.1em] text-[#4A5568]">主要ターミナル駅へ</h3>
        </div>

        <div class="grid grid-cols-2 gap-x-8 gap-y-5">
          ${stationRoutesHtml}
        </div>
      </div>

      <!-- 空港へのアクセス -->
      ${
				content.airportRoutes.length > 0
					? `
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-5">
          <svg class="w-7 h-7 text-[#C5A059]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
          <h3 class="text-[26px] font-sans font-light tracking-[0.1em] text-[#4A5568]">空港へのアクセス</h3>
        </div>

        <div class="flex gap-10">
          ${airportRoutesHtml}
        </div>
      </div>
      `
					: ""
			}

      <!-- 注釈 -->
      <div class="pt-6 border-t border-[#E2E8F0] flex items-center gap-5">
        <svg class="w-5 h-5 text-[#A0AEC0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-[13px] text-[#718096] font-sans">
          ※所要時間は乗換時間を含んだ目安です。時間帯や運行状況により異なる場合があります。
        </p>
      </div>
    </div>

  </main>
</div>`;
}
