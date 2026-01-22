/**
 * 8. Funding（資金計画）テンプレート - Refined
 * コンセプト: 明瞭なフィナンシャル・サマリー
 */

import type { FundingContent } from "../../schemas/slide-content";
import { SLIDE_CONTAINER_CLASS, escapeHtml, NUMBER_FONT_STYLE } from "../design-system";

export function renderFundingSlide(content: FundingContent): string {
  return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <header class="flex-shrink-0 mb-8 relative z-10">
    <div class="flex items-center gap-4 mb-5">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Financial Plan</span>
    </div>
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C] mb-5">
          資金計画シミュレーション
        </h1>
        <p class="text-[20px] text-[#4A5568] font-sans">
          本物件の月々の実質負担額シミュレーション（概算）
        </p>
      </div>
      
      <div class="text-right">
        <div class="text-[16px] font-sans font-bold tracking-[0.1em] text-[#A0AEC0] uppercase mb-2">Estimated Monthly Payment</div>
        <div class="flex items-baseline justify-end gap-2 text-[#C5A059]">
          <span class="text-[96px] font-serif font-bold leading-none tracking-tighter filter drop-shadow-sm">
            <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.monthlyPayments.total.replace(/円$/, ''))}</span><span class="text-[48px]">円</span>
          </span>
          </div>
      </div>
    </div>
  </header>

  <main class="flex-1 min-h-0 grid grid-cols-3 gap-10 relative z-10 pt-8">
    
    <section class="flex flex-col h-full bg-white border border-[#E2E8F0] shadow-sm relative group">
      <div class="absolute top-0 left-0 w-full h-[5px] bg-[#A0AEC0]"></div>
      
      <div class="p-10 flex-1 flex flex-col gap-10">
        <h3 class="text-[22px] font-sans font-bold text-[#2D3748] flex items-center gap-4">
          <span class="w-8 h-8 rounded-full bg-[#EDF2F7] text-[#A0AEC0] text-[14px] flex items-center justify-center font-bold">1</span>
          資金計画シミュレーション
        </h3>
        
        <div class="space-y-8">
          <div class="flex flex-col gap-2 border-b border-[#E2E8F0] pb-3">
            <span class="text-[14px] text-[#718096] uppercase tracking-wider font-sans">Property Price</span>
            <span class="text-[40px] font-serif font-medium text-[#1A202C]">
              <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.loanConditions.propertyPrice.replace(/円$/, ''))}</span><span class="text-[24px]">円</span>
            </span>
          </div>

          <div class="flex flex-col gap-2 border-b border-[#E2E8F0] pb-3">
            <span class="text-[14px] text-[#718096] uppercase tracking-wider font-sans">Down Payment (Head Money)</span>
            <span class="text-[40px] font-serif font-medium text-[#1A202C]">
              <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.loanConditions.downPayment.replace(/円$/, ''))}</span><span class="text-[24px]">円</span>
            </span>
          </div>

          <div class="flex flex-col gap-2 border-b border-[#E2E8F0] pb-3 bg-[#F7FAFC] -mx-3 px-3 rounded-sm">
            <span class="text-[14px] text-[#4A5568] uppercase tracking-wider font-sans font-bold">Loan Amount</span>
            <span class="text-[48px] font-serif font-bold text-[#2D3748]">
              <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.loanConditions.loanAmount.replace(/円$/, ''))}</span><span class="text-[28px]">円</span>
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="flex flex-col h-full bg-white border border-[#E2E8F0] shadow-sm relative group">
      <div class="absolute top-0 left-0 w-full h-[5px] bg-[#718096]"></div>

      <div class="p-10 flex-1 flex flex-col gap-10">
        <h3 class="text-[22px] font-sans font-bold text-[#2D3748] flex items-center gap-4">
          <span class="w-8 h-8 rounded-full bg-[#EDF2F7] text-[#A0AEC0] text-[14px] flex items-center justify-center font-bold">2</span>
          ローン条件
        </h3>
        
        <div class="space-y-8">
           <div class="grid grid-cols-2 gap-5">
             <div class="flex flex-col gap-2 border-b border-[#E2E8F0] pb-3">
               <span class="text-[14px] text-[#718096] uppercase tracking-wider font-sans">Interest Rate</span>
               <span class="text-[30px] font-serif font-medium text-[#1A202C] truncate">
                 ${(content.loanConditions.loanTermAndRate.split('/')[1] || content.loanConditions.loanTermAndRate).replace(/[\d.]+%/g, (match) => `<span style="${NUMBER_FONT_STYLE}">${match.replace(/%.*/, '')}</span>%`).replace(/（.+）/, (match) => `<span class="text-[20px]">${escapeHtml(match)}</span>`)}
               </span>
             </div>
             <div class="flex flex-col gap-2 border-b border-[#E2E8F0] pb-3">
               <span class="text-[14px] text-[#718096] uppercase tracking-wider font-sans">Period</span>
               <span class="text-[30px] font-serif font-medium text-[#1A202C] truncate">
                 <span style="${NUMBER_FONT_STYLE}">${escapeHtml((content.loanConditions.loanTermAndRate.split('/')[0] || '35年').replace(/年$/, ''))}</span><span class="text-[20px]">年</span>
               </span>
             </div>
           </div>

           <div class="flex flex-col gap-2 border-b border-[#E2E8F0] pb-3">
             <span class="text-[14px] text-[#718096] uppercase tracking-wider font-sans">Bonus Payment</span>
             <span class="text-[30px] font-serif font-medium text-[#1A202C]" style="${NUMBER_FONT_STYLE}">0円</span>
             </div>

           <div class="flex flex-col gap-2 pt-2">
             <span class="text-[14px] text-[#718096] uppercase tracking-wider font-sans">Loan Repayment / Month</span>
             <span class="text-[40px] font-serif font-bold text-[#2D3748]">
               <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.monthlyPayments.loanRepayment.replace(/円$/, ''))}</span><span class="text-[24px]">円</span>
             </span>
           </div>
        </div>
      </div>
      
      <div class="absolute top-1/2 -right-7 transform -translate-y-1/2 z-10 text-[#CBD5E0]">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </section>

    <section class="flex flex-col h-full bg-[#1A202C] text-white shadow-lg relative overflow-hidden transform scale-105 origin-center z-10">
      <div class="absolute top-0 left-0 w-full h-[5px] bg-[#C5A059]"></div>
      <div class="absolute bottom-0 right-0 w-40 h-40 bg-[#C5A059] opacity-10 rounded-full translate-x-12 translate-y-12 blur-xl"></div>

      <div class="p-12 flex-1 flex flex-col justify-between">
        <div>
          <h3 class="text-[24px] font-sans font-bold text-[#C5A059] flex items-center gap-4 mb-10">
            <span class="w-8 h-8 rounded-full bg-[#C5A059] text-[#1A202C] text-[14px] flex items-center justify-center font-bold">3</span>
            月々の支払総額
          </h3>
          
          <div class="space-y-8">
            <div class="flex justify-between items-center border-b border-white/20 pb-3">
              <span class="text-[18px] text-white/70 font-sans">ローン返済額</span>
              <span class="text-[30px] font-serif font-medium">
                <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.monthlyPayments.loanRepayment.replace(/円$/, ''))}</span><span class="text-[20px]">円</span>
              </span>
            </div>
            <div class="flex justify-between items-center border-b border-white/20 pb-3">
              <span class="text-[18px] text-white/70 font-sans">管理費</span>
              <span class="text-[30px] font-serif font-medium">
                <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.monthlyPayments.managementFee.replace(/円$/, ''))}</span><span class="text-[20px]">円</span>
              </span>
            </div>
            <div class="flex justify-between items-center border-b border-white/20 pb-3">
              <span class="text-[18px] text-white/70 font-sans">修繕積立金</span>
              <span class="text-[30px] font-serif font-medium">
                <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.monthlyPayments.repairReserve.replace(/円$/, ''))}</span><span class="text-[20px]">円</span>
              </span>
            </div>
          </div>
        </div>

        <div class="mt-10 pt-8 border-t border-[#C5A059]">
          <div class="text-[14px] font-sans font-bold tracking-[0.2em] text-[#C5A059] uppercase mb-3">Total Monthly Cost</div>
          <div class="text-[68px] font-serif font-bold leading-none tracking-tight">
            <span style="${NUMBER_FONT_STYLE}">${escapeHtml(content.monthlyPayments.total.replace(/円$/, ''))}</span><span class="text-[40px]">円</span>
          </div>
        </div>
      </div>
    </section>

  </main>
  
  <footer class="flex-shrink-0 mt-6 text-right">
    ${
      content.note
        ? `<p class="text-[14px] font-sans text-[#A0AEC0] leading-relaxed max-w-3xl ml-auto text-justify">
            ${escapeHtml(content.note)}
           </p>`
        : `<p class="text-[14px] font-sans text-[#A0AEC0]">
            ※頭金や金利等の条件により異なります。別途、購入諸費用（登記費用・仲介手数料等）や固定資産税・都市計画税がかかります。
            シミュレーション結果は概算であり、将来の金利動向等を保証するものではありません。
           </p>`
    }
  </footer>
</div>`;
}