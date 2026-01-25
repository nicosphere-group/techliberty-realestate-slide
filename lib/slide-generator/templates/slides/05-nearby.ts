/**
 * 5. Nearby（周辺施設）テンプレート - Refined
 * 左：地図分析図 / 右：施設リスト
 * マーカー色と施設リストの色を統一
 */

import type { NearbyContent } from "../../schemas/slide-content";
import {
	escapeHtml,
	NUMBER_FONT_STYLE,
	SLIDE_CONTAINER_CLASS,
} from "../design-system";

/**
 * 連番をマーカーラベルに変換（Google Static Maps互換）
 */
function getMarkerLabel(num: number): string {
	if (num <= 9) return String(num);
	return String.fromCharCode(65 + num - 10); // 10以上はA, B, C...
}

export function renderNearbySlide(content: NearbyContent): string {
	// 施設グループ（カテゴリごとの塊）の生成 - 2x2グリッド用
	// カテゴリ内の施設を番号順にソート
	const facilityGroupsHtml = content.facilityGroups
		.map((group) => {
			const color = group.color; // HTMLカラーコードを直接使用
			const sortedFacilities = [...group.facilities].sort(
				(a, b) => a.number - b.number,
			);

			// 各施設アイテムの生成（連番表示・大きめサイズ）
			const facilitiesHtml = sortedFacilities
				.map((facility) => {
					const label = getMarkerLabel(facility.number);
					return `<div class="flex items-center justify-between py-3">
          <div class="flex items-center gap-4 flex-1 min-w-0">
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0" style="background-color: ${color}; ${NUMBER_FONT_STYLE}">
              ${label}
            </div>
            <span class="text-[22px] font-medium text-[#2D3748] font-sans truncate">
              ${escapeHtml(facility.name)}
            </span>
          </div>
          <div class="flex-shrink-0 flex items-baseline gap-1 ml-4">
            <span class="text-[32px] font-serif font-bold" style="color: ${color}; ${NUMBER_FONT_STYLE}">${escapeHtml(facility.distance)}</span>
            <span class="text-[14px] text-[#718096] font-sans">分</span>
          </div>
        </div>`;
				})
				.join("\n");

			// カテゴリブロック（2x2グリッド用・大きめサイズ）
			return `<div class="h-full flex flex-col">
        <div class="flex items-center gap-3 mb-4 pb-3 border-b-2" style="border-color: ${color};">
          <div class="w-4 h-4 rounded-full" style="background-color: ${color};"></div>
          <h3 class="text-[20px] font-sans font-bold tracking-[0.05em]" style="color: ${color};">
            ${escapeHtml(group.category)}
          </h3>
        </div>
        <div class="flex-1 space-y-1">
          ${facilitiesHtml}
        </div>
      </div>`;
		})
		.join("\n");

	return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <header class="flex-shrink-0 mb-8 relative z-10">
    <div class="flex items-center gap-4 mb-5">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Life Information</span>
    </div>
    <div class="flex justify-between items-end">
      <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
        ライフインフォメーション
      </h1>
      <p class="hidden md:block text-[18px] font-sans text-[#718096] max-w-[480px] text-right leading-relaxed">
        豊かな緑と生活利便性が調和する、<br>洗練されたロケーション。
      </p>
    </div>
  </header>

  <main class="flex-1 min-h-0 flex gap-14 relative z-10 overflow-hidden">
    
    <div class="w-[45%] flex flex-col h-full bg-white border border-[#E2E8F0] p-4 shadow-sm relative">
      <div class="flex-1 relative overflow-hidden bg-[#EDF2F7]">
        ${
					content.mapImageUrl
						? `<img src="${escapeHtml(content.mapImageUrl)}" class="w-full h-full object-cover" alt="Area Map">`
						: `<div class="absolute inset-0 flex items-center justify-center text-[#A0AEC0] font-sans tracking-widest text-xl">地図</div>`
				}
      </div>
      
      <!-- 凡例 -->
      <div class="mt-4 pt-4 border-t border-[#E2E8F0]">
        <div class="flex flex-wrap gap-5 mb-3">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-full bg-[#EF4444] flex items-center justify-center text-white text-[14px] font-bold" style="${NUMBER_FONT_STYLE}">P</div>
            <span class="text-[15px] text-[#4A5568] font-sans">物件</span>
          </div>
          ${content.facilityGroups
						.map(
							(group) => `
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-full" style="background-color: ${group.color};"></div>
            <span class="text-[15px] text-[#4A5568] font-sans">${escapeHtml(group.category)}</span>
          </div>`,
						)
						.join("")}
        </div>
        <div class="flex items-center justify-between text-[#4A5568]">
          <span class="text-[12px] font-sans font-medium tracking-wider uppercase opacity-60">所在地</span>
          <span class="text-[16px] font-sans font-medium">${escapeHtml(content.address)}</span>
        </div>
      </div>
    </div>

    <div class="flex-1 h-full overflow-hidden flex flex-col">
      <!-- 2x2グリッドレイアウト - 右側を広く使用 -->
      <div class="flex-1 grid grid-cols-2 gap-x-10 gap-y-6">
        ${facilityGroupsHtml}
      </div>

      <div class="mt-3 pt-3 border-t border-[#E2E8F0] flex items-center gap-4 opacity-80">
        <span class="text-[14px] font-sans text-[#64748B] tracking-wider">距離情報</span>
        <p class="text-[14px] font-sans text-[#475569]">
          ※徒歩分数は80mを1分として算出。番号は物件からの近さ順。
        </p>
      </div>
    </div>

  </main>
</div>`;
}
