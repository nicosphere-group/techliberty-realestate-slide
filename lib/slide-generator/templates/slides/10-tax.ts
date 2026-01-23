/**
 * 10. Tax（税制情報）テンプレート - 静的版
 * コンセプト: Tax Benefit Specification（税制優遇スペックシート）
 *
 * このスライドは完全に静的なテンプレートです。
 * LLMによるコンテンツ生成は不要です。
 */

import { NUMBER_FONT_STYLE, SLIDE_CONTAINER_CLASS } from "../design-system";

export function renderTaxSlide(): string {
	return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <div class="absolute top-[200px] left-0 w-full h-[1px] bg-[#E2E8F0] pointer-events-none"></div>

  <header class="flex-shrink-0 mb-10 relative z-10">
    <div class="flex items-center gap-4 mb-5">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Tax Benefits</span>
    </div>
    <div class="flex justify-between items-end">
      <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
        住宅ローン控除
      </h1>
      <div class="text-right max-w-xl">
        <p class="text-[18px] font-sans text-[#718096] leading-relaxed">
          住宅ローン控除をはじめとする各種税制優遇により、<br>実質的な住居費負担が軽減されます。
        </p>
      </div>
    </div>
  </header>

  <main class="flex-1 min-h-0 flex gap-12 relative z-10">

    <div class="w-[35%] flex flex-col gap-10 pt-4">
      <div class="bg-white border-l-4 border-[#C5A059] p-10 shadow-sm">
        <h3 class="text-[26px] font-serif font-bold text-[#1A202C] mb-5">
          住宅ローン控除とは
        </h3>
        <p class="text-[18px] font-sans leading-[1.8] text-[#4A5568] text-justify">
          個人が住宅ローンを利用してマイホームの新築・取得を行った際、一定の要件を満たす場合に一定金額を所得税（一部住民税）から控除される税制上の優遇処置です。
        </p>
      </div>

      <div class="flex flex-col gap-6">
        <div class="flex items-center gap-5">
          <div class="w-14 h-14 rounded-full bg-[#1A202C] text-[#C5A059] flex items-center justify-center font-serif font-bold text-2xl" style="${NUMBER_FONT_STYLE}">1</div>
          <p class="text-[22px] font-bold text-[#2D3748]">最大<span style="${NUMBER_FONT_STYLE}">13</span>年間の税額控除</p>
        </div>
        <div class="flex items-center gap-5">
          <div class="w-14 h-14 rounded-full bg-[#1A202C] text-[#C5A059] flex items-center justify-center font-serif font-bold text-2xl" style="${NUMBER_FONT_STYLE}">2</div>
          <p class="text-[22px] font-bold text-[#2D3748]">年末残高の<span style="${NUMBER_FONT_STYLE}">0.7</span>%が還付</p>
        </div>
        <div class="flex items-center gap-5">
          <div class="w-14 h-14 rounded-full bg-[#1A202C] text-[#C5A059] flex items-center justify-center font-serif font-bold text-2xl" style="${NUMBER_FONT_STYLE}">3</div>
          <p class="text-[22px] font-bold text-[#2D3748]">省エネ基準適合で枠拡大</p>
        </div>
      </div>
    </div>

    <div class="flex-1 bg-white border border-[#E2E8F0] shadow-lg flex flex-col relative overflow-hidden">
      <div class="bg-[#1A202C] text-white p-8 grid grid-cols-12 items-center">
        <div class="col-span-4 text-[14px] font-sans font-bold tracking-[0.2em] uppercase opacity-70">Category</div>
        <div class="col-span-4 text-center border-r border-white/20">
          <span class="text-[20px] font-serif font-medium text-white/70 block">新築・買取再販</span>
          <span class="text-[11px] font-sans opacity-50 uppercase tracking-widest">New / Renovation</span>
        </div>
        <div class="col-span-4 text-center bg-[#C5A059] -my-8 py-8 -mr-8">
          <span class="text-[24px] font-serif font-bold text-white block">中古マンション</span>
          <span class="text-[11px] font-sans text-white/80 uppercase tracking-widest">Existing Apartment</span>
        </div>
      </div>

      <div class="flex-1 flex flex-col justify-center p-3">
        <div class="grid grid-cols-12 py-8 border-b border-[#E2E8F0] items-center">
          <div class="col-span-4 pl-10">
             <span class="text-[16px] font-bold text-[#4A5568] uppercase tracking-widest block mb-2">Period</span>
             <span class="text-[22px] font-serif font-bold text-[#1A202C]">控除期間</span>
          </div>
          <div class="col-span-4 text-center border-l border-[#E2E8F0]">
            <span class="text-[42px] font-serif font-medium text-[#718096] leading-none"><span style="${NUMBER_FONT_STYLE}">13</span><span class="text-[18px] ml-2">年</span></span>
          </div>
          <div class="col-span-4 text-center border-l-2 border-[#C5A059] bg-[#FDF8F3]">
            <span class="text-[56px] font-serif font-bold text-[#C5A059] leading-none"><span style="${NUMBER_FONT_STYLE}">10</span><span class="text-[22px] text-[#2D3748] ml-2">年</span></span>
          </div>
        </div>

        <div class="grid grid-cols-12 py-7 border-b border-[#E2E8F0] items-center">
          <div class="col-span-4 pl-10">
             <span class="text-[14px] font-bold text-[#A0AEC0] uppercase tracking-widest block mb-2">Rate</span>
             <span class="text-[20px] font-serif font-medium text-[#2D3748]">控除率</span>
          </div>
          <div class="col-span-4 text-center border-l border-[#E2E8F0]">
            <span class="text-[32px] font-serif font-medium text-[#718096]"><span style="${NUMBER_FONT_STYLE}">0.7</span><span class="text-[18px] ml-2">%</span></span>
          </div>
          <div class="col-span-4 text-center border-l-2 border-[#C5A059] bg-[#FDF8F3]">
            <span class="text-[40px] font-serif font-bold text-[#C5A059]"><span style="${NUMBER_FONT_STYLE}">0.7</span><span class="text-[20px] text-[#2D3748] ml-2">%</span></span>
          </div>
        </div>

        <div class="grid grid-cols-12 py-7 border-b border-[#E2E8F0] items-center">
          <div class="col-span-4 pl-10">
             <span class="text-[14px] font-bold text-[#A0AEC0] uppercase tracking-widest block mb-2">Loan Limit</span>
             <span class="text-[20px] font-serif font-medium text-[#2D3748]">借入残高上限</span>
          </div>
          <div class="col-span-4 text-center border-l border-[#E2E8F0] px-3">
            <span class="text-[24px] font-serif font-medium text-[#718096] leading-tight"><span style="${NUMBER_FONT_STYLE}">3,000~5,000</span><span class="text-[14px] ml-2">万</span></span>
          </div>
          <div class="col-span-4 text-center border-l-2 border-[#C5A059] bg-[#FDF8F3] px-3">
            <span class="text-[28px] font-serif font-bold text-[#C5A059] leading-tight"><span style="${NUMBER_FONT_STYLE}">2,000~3,000</span><span class="text-[16px] text-[#2D3748] ml-2">万</span></span>
          </div>
        </div>

         <div class="grid grid-cols-12 py-7 items-center">
          <div class="col-span-4 pl-10">
             <span class="text-[14px] font-bold text-[#A0AEC0] uppercase tracking-widest block mb-2">Requirement</span>
             <span class="text-[20px] font-serif font-medium text-[#2D3748]">省エネ基準</span>
          </div>
          <div class="col-span-4 text-center border-l border-[#E2E8F0]">
            <span class="inline-block px-4 py-2 border border-[#A0AEC0] text-[#718096] text-[14px] rounded-full">原則必須</span>
          </div>
          <div class="col-span-4 text-center border-l-2 border-[#C5A059] bg-[#FDF8F3]">
            <span class="inline-block px-5 py-2 bg-[#C5A059] text-white text-[16px] font-bold rounded-full">特になし</span>
          </div>
        </div>
      </div>

      <div class="absolute bottom-5 right-5 opacity-10 pointer-events-none">
         <div class="w-32 h-32 border-2 border-[#1A202C] rounded-full flex items-center justify-center transform -rotate-12">
            <span class="text-[12px] font-bold uppercase text-[#1A202C] text-center">Tax<br>Incentive<br>Eligible</span>
         </div>
      </div>
    </div>

  </main>

  <footer class="flex-shrink-0 mt-8 border-t border-[#E2E8F0] pt-5">
    <p class="text-[14px] font-sans text-[#A0AEC0] text-right">
      ※<span style="${NUMBER_FONT_STYLE}">2024</span>年度時点の税制に基づく内容です。物件の省エネ性能や入居時期により条件が異なる場合があります。詳細は税務署等にご確認ください。
    </p>
  </footer>
</div>`;
}
