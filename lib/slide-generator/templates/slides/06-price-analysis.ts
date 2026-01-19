/**
 * 6. Price Analysis（価格分析）テンプレート - Refined
 * コンセプト: 高級感のあるデータ・グリッド
 */

import type { PriceAnalysisContent } from "../../schemas/slide-content";
import { SLIDE_CONTAINER_CLASS, escapeHtml } from "../design-system";

/**
 * 建築年から築年数を計算する
 * 例: "1982年" → "43年"、"1985" → "41年"
 */
function calculateBuildingAge(ageStr: string): string {
  const currentYear = new Date().getFullYear();
  // 数字部分を抽出（例: "1982年" → 1982、"1985" → 1985）
  const yearMatch = ageStr.match(/\d+/);
  if (!yearMatch) return ageStr;
  
  const builtYear = Number.parseInt(yearMatch[0], 10);
  // 4桁の年のみ計算対象
  if (builtYear < 1900 || builtYear > currentYear) return ageStr;
  
  const age = currentYear - builtYear;
  return `${age}年`;
}

export function renderPriceAnalysisSlide(content: PriceAnalysisContent): string {
  // 類似物件データ（テーブル行）の生成
  const tableRowsHtml = content.similarProperties
    ? content.similarProperties
        .map(
          (prop, index) => `<tr class="border-b border-[#E2E8F0] last:border-0">
          <td class="py-5 pl-8 pr-5 text-[22px] font-sans font-medium text-[#2D3748]">${escapeHtml(prop.name)}</td>
          <td class="py-5 px-5 text-[22px] font-serif text-[#1A202C] text-center tabular-nums">${escapeHtml(calculateBuildingAge(prop.age))}</td>
          <td class="py-5 px-5 text-[22px] font-serif text-[#1A202C] text-center tabular-nums">${escapeHtml(prop.area)}</td>
          <td class="py-5 px-5 text-[22px] font-serif text-[#1A202C] text-right tabular-nums tracking-wide">${escapeHtml(prop.price)}</td>
          <td class="py-5 pl-5 pr-8 text-[22px] font-serif font-bold text-[#1A202C] text-right tabular-nums bg-[#F7F5F2] tracking-wide">
            ${escapeHtml(prop.unitPrice)}
          </td>
        </tr>`,
        )
        .join("\n")
    : `<tr class="border-b border-[#E2E8F0]"><td colspan="5" class="py-10 text-center text-[#A0AEC0] text-xl">No Comparable Data Available</td></tr>`;

  return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">
  
  <div class="absolute top-0 right-[20%] w-[1px] h-full bg-[#E2E8F0] pointer-events-none"></div>

  <header class="flex-shrink-0 mb-10 relative z-10">
    <div class="flex items-center gap-4 mb-5">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Market Analysis</span>
    </div>
    <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
     周辺相場・価格分析
    </h1>
  </header>

  <main class="flex-1 min-h-0 flex flex-col gap-10 relative z-10">
    
    <section class="flex flex-col gap-5">
      <h2 class="text-[32px] font-sans font-medium text-[#4A5568] leading-relaxed">
        近隣の類似物件の取引事例は以下の通りです。<br>
        当物件の<span class="border-b-2 border-[#C5A059] pb-1">価格設定の妥当性</span>をご確認ください。
      </h2>

      <div class="bg-white border-l-4 border-[#C5A059] shadow-sm p-10 flex items-center gap-10 mt-2">
        <div class="text-[16px] font-sans font-bold tracking-[0.2em] text-[#A0AEC0] uppercase">
          Estimated<br>Market Price
        </div>
        <div class="w-[2px] h-16 bg-[#E2E8F0]"></div>
        <div class="flex items-baseline gap-3">
          <span class="text-[80px] font-serif font-bold text-[#1A202C] leading-none tracking-tight">
            ${escapeHtml(content.estimatedPriceMin)} <span class="text-[50px] font-light text-[#A0AEC0] mx-3">~</span> ${escapeHtml(content.estimatedPriceMax)}
          </span>
          <span class="text-[26px] font-sans font-medium text-[#718096]">万円</span>
        </div>
        <div class="ml-auto bg-[#F7F5F2] px-6 py-3 rounded-full">
           <span class="text-[14px] font-sans font-bold text-[#C5A059] tracking-widest">MARKET RANGE</span>
        </div>
      </div>
    </section>

    <section class="flex-1 min-h-0 overflow-hidden flex flex-col">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-[24px] font-sans font-bold text-[#1A202C] flex items-center gap-4">
          <span class="w-1.5 h-8 bg-[#C5A059]"></span>
          類似物件情報
        </h3>
        <p class="text-[16px] text-[#718096] font-sans">
          ※ 国土交通省 不動産取引価格情報より
        </p>
      </div>

      <div class="flex-1 bg-white border border-[#E2E8F0] shadow-sm">
        <table class="w-full border-collapse">
          <thead class="bg-[#1A202C] text-white">
            <tr>
              <th class="py-5 pl-8 pr-5 text-left text-[18px] font-sans font-bold w-[35%]">物件名</th>
              <th class="py-5 px-5 text-center text-[18px] font-sans font-bold w-[12%]">築年数(年)</th>
              <th class="py-5 px-5 text-center text-[18px] font-sans font-bold w-[12%]">面積(㎡)</th>
              <th class="py-5 px-5 text-right text-[18px] font-sans font-bold w-[18%]">取引価格(万円)</th>
              <th class="py-5 pl-5 pr-8 text-right text-[18px] font-sans font-bold w-[23%] text-[#C5A059]">坪単価(万円)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

  </main>
</div>`;
}