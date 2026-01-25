/**
 * 3. Floor Plan（間取り詳細）テンプレート - Refined
 * 左に画像、右に詳細の統一レイアウト
 * 画像は縦横問わずコンテナに収まるように自動調整
 */

import type { FloorPlanContent } from "../../schemas/slide-content";
import {
	escapeHtml,
	NUMBER_FONT_STYLE,
	SLIDE_CONTAINER_CLASS,
} from "../design-system";

/**
 * バルコニーの値が面積（数値）を含むかどうかを判定
 * 「あり」「別記なし」などの文字列は面積ではないので false を返す
 */
function hasBalconyArea(balcony: string | undefined): boolean {
	if (!balcony) return false;
	// 数字を含む場合は面積として扱う（例: "5.5㎡", "3.2m²"）
	return /\d/.test(balcony);
}

export function renderFloorPlanSlide(content: FloorPlanContent): string {
	// バルコニー面積が存在するかチェック
	const showBalcony = hasBalconyArea(content.specs.balcony);

	// ポイントリストの生成
	const pointsHtml = content.points
		.map(
			(point, index) => `<div class="group">
      <div class="flex items-baseline gap-4 mb-3">
        <span class="text-[18px] font-sans font-bold text-[#C5A059] tracking-widest" style="${NUMBER_FONT_STYLE}">0${index + 1}</span>
        <h3 class="text-[32px] font-serif font-bold text-[#1A202C]">
          ${escapeHtml(point.title)}
        </h3>
      </div>
      <p class="text-[24px] font-sans font-normal leading-[1.8] text-[#2D3748] pl-10 border-l-2 border-[#E2E8F0]">
        ${escapeHtml(point.description)}
      </p>
    </div>`,
		)
		.join("\n");

	// 統一レイアウト（左に画像、右に詳細）
	return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <header class="flex-shrink-0 mb-8 relative z-10">
    <div class="flex items-center gap-4 mb-5">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Layout Details</span>
    </div>
    <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
      間取り図・図面情報
    </h1>
  </header>

  <main class="flex-1 min-h-0 grid grid-cols-12 gap-14 relative z-10">

    <!-- 画像エリア（左側） -->
    <div class="col-span-7 h-full min-h-0 bg-white border border-[#E2E8F0] p-6 relative flex items-center justify-center overflow-hidden">
      <div class="absolute top-0 left-0 bg-[#1A202C] text-white px-5 py-2 z-10">
        <span class="text-[14px] font-sans font-bold tracking-[0.2em] uppercase" style="${NUMBER_FONT_STYLE}">間取り図</span>
      </div>

      ${
				content.imageUrl
					? `<img src="${escapeHtml(content.imageUrl)}" alt="間取り図" class="max-w-full max-h-full object-contain filter contrast-[1.05] opacity-90">`
					: `<div class="text-[#CBD5E0] font-sans font-light text-3xl tracking-widest">画像なし</div>`
			}

      ${
				content.imageUrl
					? `
      <div class="absolute bottom-3 right-3 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded z-10">
        <span class="text-[14px] font-sans text-white/80">※AIにより生成された画像です</span>
      </div>
      `
					: ""
			}
    </div>

    <!-- 詳細エリア（右側） -->
    <div class="col-span-5 flex flex-col h-full min-h-0">

      <div class="grid grid-cols-2 gap-y-8 gap-x-6 border-b-2 border-[#C5A059] pb-10 mb-10">
        <div>
          <span class="text-[14px] font-sans font-bold tracking-[0.2em] text-[#A0AEC0] uppercase block mb-2">間取り</span>
          <span class="text-[42px] font-serif font-medium text-[#1A202C] leading-none">
            ${escapeHtml(content.specs.layout).replace(/(\d+)/g, `<span style="${NUMBER_FONT_STYLE}">$1</span>`)}
          </span>
        </div>
        <div>
          <span class="text-[14px] font-sans font-bold tracking-[0.2em] text-[#A0AEC0] uppercase block mb-2">専有面積</span>
          <span class="text-[42px] font-serif font-medium text-[#1A202C] leading-none">
            <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.specs.area.replace(/[㎡m²]/g, ""))}</span><span class="text-[32px]">${content.specs.area.match(/[㎡m²]/)?.[0] || "㎡"}</span>
          </span>
        </div>
        ${
					showBalcony
						? `<div class="col-span-2">
                <span class="text-[14px] font-sans font-bold tracking-[0.2em] text-[#A0AEC0] uppercase block mb-2">バルコニー</span>
                <span class="text-[32px] font-serif font-medium text-[#4A5568] leading-none">
                  <span style="${NUMBER_FONT_STYLE}">${escapeHtml((content.specs.balcony ?? "").replace(/[㎡m²]/g, ""))}</span><span class="text-[24px]">${content.specs.balcony?.match(/[㎡m²]/)?.[0] || "㎡"}</span>
                </span>
               </div>`
						: ""
				}
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto pr-3 space-y-8 custom-scrollbar pb-4">
        ${pointsHtml}
      </div>

    </div>
  </main>
</div>`;
}
