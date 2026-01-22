/**
 * 6. Price Analysis（価格分析）テンプレート
 */

import type { PriceAnalysisContent } from "../../schemas/slide-content";
import { SLIDE_CONTAINER_CLASS, escapeHtml, NUMBER_FONT_STYLE } from "../design-system";

/**
 * 建築年から築年数を計算する
 */
function calculateBuildingAge(ageStr: string): string {
  const currentYear = new Date().getFullYear();
  const yearMatch = ageStr.match(/\d+/);
  if (!yearMatch) return ageStr;
  
  const builtYear = Number.parseInt(yearMatch[0], 10);
  if (builtYear < 1900 || builtYear > currentYear) return ageStr;
  
  const age = currentYear - builtYear;
  return `${age}年`;
}

export function renderPriceAnalysisSlide(content: PriceAnalysisContent): string {
  // 対象物件データ（テーブル行）
  const targetPropertyRowHtml = content.targetProperty
    ? `<tr class="border-b-4 border-[#C5A059] bg-gradient-to-r from-[#FFF9F0] to-[#FFFAF5]">
        <td class="py-4 pl-6 pr-4 text-[20px] font-sans font-bold text-[#1A202C] leading-snug">
          ${escapeHtml(content.targetProperty.name)}
          <span class="ml-2 text-[12px] font-sans font-bold text-[#C5A059] bg-white px-2 py-0.5 rounded-full border border-[#C5A059] align-middle">対象</span>
        </td>
        <td class="py-4 px-4 text-[20px] font-serif font-bold text-[#1A202C] text-center tabular-nums">
          <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.targetProperty.age.replace(/年$/, ''))}</span><span class="text-[16px]">年</span>
        </td>
        <td class="py-4 px-4 text-[20px] font-serif font-bold text-[#1A202C] text-center tabular-nums">
          <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.targetProperty.area.replace(/[㎡m²]/g, ''))}</span><span class="text-[16px]">${content.targetProperty.area.match(/[㎡m²]/)?.[0] || '㎡'}</span>
        </td>
        <td class="py-4 px-4 text-[20px] font-serif font-bold text-[#1A202C] text-right tabular-nums tracking-wide">
          <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.targetProperty.price.replace(/万円$/, ''))}</span><span class="text-[16px]">万円</span>
        </td>
        <td class="py-4 pl-4 pr-6 text-[22px] font-serif font-bold text-[#C5A059] text-right tabular-nums bg-white tracking-wide">
          <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.targetProperty.unitPrice.replace(/万円$/, ''))}</span><span class="text-[18px]">万円</span>
        </td>
      </tr>`
    : "";

  // 類似物件データ（テーブル行）
  const tableRowsHtml = content.similarProperties
    ? content.similarProperties
        .map(
          (prop) => {
            const age = calculateBuildingAge(prop.age);
            return `<tr class="border-b border-[#E2E8F0] last:border-0 hover:bg-gray-50">
          <td class="py-3 pl-6 pr-4 text-[18px] font-sans font-medium text-[#2D3748] truncate max-w-[300px]">${escapeHtml(prop.name)}</td>
          <td class="py-3 px-4 text-[18px] font-serif text-[#1A202C] text-center tabular-nums">
            <span style="${NUMBER_FONT_STYLE}">${escapeHtml(age.replace(/年$/, ''))}</span><span class="text-[14px]">年</span>
          </td>
          <td class="py-3 px-4 text-[18px] font-serif text-[#1A202C] text-center tabular-nums">
            <span style="${NUMBER_FONT_STYLE}">${escapeHtml(prop.area.replace(/[㎡m²]/g, ''))}</span><span class="text-[14px]">${prop.area.match(/[㎡m²]/)?.[0] || '㎡'}</span>
          </td>
          <td class="py-3 px-4 text-[18px] font-serif text-[#1A202C] text-right tabular-nums tracking-wide">
            <span style="${NUMBER_FONT_STYLE}">${escapeHtml(prop.price.replace(/万円$/, ''))}</span><span class="text-[14px]">万円</span>
          </td>
          <td class="py-3 pl-4 pr-6 text-[18px] font-serif font-bold text-[#1A202C] text-right tabular-nums bg-[#F7F5F2] tracking-wide">
            <span style="${NUMBER_FONT_STYLE}">${escapeHtml(prop.unitPrice.replace(/万円$/, ''))}</span><span class="text-[14px]">万円</span>
          </td>
        </tr>`;
          },
        )
        .join("\n")
    : `<tr class="border-b border-[#E2E8F0]"><td colspan="5" class="py-8 text-center text-[#A0AEC0] text-lg">No Comparable Data Available</td></tr>`;

  return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-16 py-10 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <header class="flex-shrink-0 mb-6 relative z-10">
    <div class="flex items-center gap-3 mb-3">
      <div class="h-[2px] w-10 bg-[#C5A059]"></div>
      <span class="text-[14px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Market Analysis</span>
    </div>
    <h1 class="text-[56px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
     周辺相場・価格分析
    </h1>
  </header>

  <main class="flex-1 min-h-0 flex flex-col gap-6 relative z-10">
    
    <section class="flex flex-col gap-3 flex-shrink-0">
      <h2 class="text-[22px] font-sans font-medium text-[#4A5568] leading-normal flex items-center">
        近隣類似物件の取引事例は以下の通りです。当物件の<span class="border-b-2 border-[#C5A059] mx-1 font-bold text-[#2D3748]">価格設定の妥当性</span>をご確認ください。
      </h2>

      <div class="bg-white border-l-4 border-[#C5A059] shadow-sm py-4 px-8 flex items-center gap-8 mt-1">
        <div class="text-[14px] font-sans font-bold tracking-[0.15em] text-[#A0AEC0] uppercase leading-tight text-right">
          Estimated<br>Market Price
        </div>
        <div class="w-[1px] h-12 bg-[#E2E8F0]"></div>
        <div class="flex items-baseline gap-3">
          <span class="text-[64px] font-serif font-bold text-[#1A202C] leading-none tracking-tight" style="${NUMBER_FONT_STYLE}">
            ${escapeHtml(content.estimatedPriceMin)} <span class="text-[40px] font-light text-[#A0AEC0] mx-2" style="${NUMBER_FONT_STYLE}">~</span> ${escapeHtml(content.estimatedPriceMax)}
          </span>
          <span class="text-[20px] font-sans font-medium text-[#718096]">万円</span>
        </div>
        <div class="ml-auto bg-[#F7F5F2] px-5 py-2 rounded-full">
           <span class="text-[12px] font-sans font-bold text-[#C5A059] tracking-widest">MARKET RANGE</span>
        </div>
      </div>
    </section>

    <section class="flex-1 min-h-0 overflow-hidden flex flex-col mt-2">
      <div class="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 class="text-[20px] font-sans font-bold text-[#1A202C] flex items-center gap-3">
          <span class="w-1 h-6 bg-[#C5A059]"></span>
          類似物件情報
        </h3>
        <p class="text-[13px] text-[#718096] font-sans">
          ※ 国土交通省 不動産取引価格情報より<span class="ml-2">（取引時期降順）</span>
        </p>
      </div>

      <div class="flex-1 bg-white border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
        <table class="w-full border-collapse">
          <thead class="bg-[#1A202C] text-white flex-shrink-0">
            <tr>
              <th class="py-3 pl-6 pr-4 text-left text-[15px] font-sans font-bold w-[35%]">物件名</th>
              <th class="py-3 px-4 text-center text-[15px] font-sans font-bold w-[12%]">築年数</th>
              <th class="py-3 px-4 text-center text-[15px] font-sans font-bold w-[12%]">面積(㎡)</th>
              <th class="py-3 px-4 text-right text-[15px] font-sans font-bold w-[18%]">${content.targetProperty ? "販売価格(万円)" : "取引価格(万円)"}</th>
              <th class="py-3 pl-4 pr-6 text-right text-[15px] font-sans font-bold w-[23%] text-[#C5A059]">坪単価(万円)</th>
            </tr>
          </thead>
          <tbody class="text-[#2D3748]">
            ${targetPropertyRowHtml}
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </section>

  </main>
</div>`;
}