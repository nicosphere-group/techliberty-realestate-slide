/**
 * 12. Flyer（マイソク）テンプレート - 静的版
 * コンセプト: Gallery Art Mode（図面を作品として展示）
 *
 * このスライドは静的なテンプレートです。
 * LLMによるコンテンツ生成は不要です。
 * 画像URLのみ外部から渡されます。
 */

import { SLIDE_CONTAINER_CLASS, escapeHtml } from "../design-system";

export function renderFlyerSlide(imageUrls: string[]): string {

  // 画像がない場合のフォールバック（洗練されたデザイン）
  if (imageUrls.length === 0) {
    return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-[#FDFCFB] flex items-center justify-center border-[24px] border-[#F0F0F0]">
      <div class="text-center">
        <div class="text-[100px] text-[#E2E8F0] mb-6">■</div>
        <p class="text-3xl font-serif text-[#A0AEC0] tracking-widest">NO FLYER IMAGE</p>
      </div>
    </div>`;
  }

  // 画像生成ロジック
  let imagesHtml = "";
  let containerClass = "";

  if (imageUrls.length === 1) {
    // 【単一画像モード】
    // 画面一杯に使いつつ、縦長画像が収まるように調整
    containerClass = "flex items-center justify-center h-full w-full relative z-10";
    imagesHtml = `
      <div class="relative h-full flex flex-col justify-center">
        <img 
          src="${escapeHtml(imageUrls[0])}" 
          alt="Sales Flyer" 
          class="max-h-[95%] w-auto object-contain shadow-[0_30px_60px_-15px_rgba(0,0,0,0.25)] border-[10px] border-white mx-auto"
        />
        <div class="absolute bottom-10 right-[-24px] translate-x-full bg-white p-3 shadow-md rounded-sm opacity-60">
           <svg class="w-8 h-8 text-[#4A5568]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
           </svg>
        </div>
      </div>
    `;
  } else {
    // 【複数画像モード】
    // 2枚なら左右分割、3枚以上ならグリッド
    // ※枚数が増えても画像が見えるように gap を調整
    const gridClass = imageUrls.length === 2 ? "grid-cols-2 gap-10" : "grid-cols-3 gap-8";
    
    const items = imageUrls.map(url => 
      `<div class="relative w-full h-full flex items-center justify-center overflow-hidden bg-white border-[5px] border-white shadow-lg">
         <img src="${escapeHtml(url)}" class="max-w-full max-h-full object-contain" />
       </div>`
    ).join("\n");

    containerClass = "h-full w-full px-10 py-10";
    imagesHtml = `<div class="w-full h-full grid ${gridClass}">${items}</div>`;
  }

  // 背景用の画像URL（1枚目を使用）
  const bgImageUrl = imageUrls[0];

  return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-[#F0F2F5] overflow-hidden relative p-0">
  
  <div class="absolute inset-0 z-0 overflow-hidden">
    <div class="absolute inset-0 bg-cover bg-center opacity-30 blur-[50px] scale-125 saturate-150" 
         style="background-image: url('${escapeHtml(bgImageUrl)}');">
    </div>
    <div class="absolute inset-0 bg-white/60 backdrop-blur-sm"></div>
    <div class="absolute inset-0 opacity-[0.05]" 
         style="background-image: radial-gradient(#1A202C 1px, transparent 1px); background-size: 28px 28px;">
    </div>
  </div>

  <div class="absolute top-8 left-8 w-10 h-10 border-t-2 border-l-2 border-[#1A202C] opacity-20 z-10"></div>
  <div class="absolute top-8 right-8 w-10 h-10 border-t-2 border-r-2 border-[#1A202C] opacity-20 z-10"></div>
  <div class="absolute bottom-8 left-8 w-10 h-10 border-b-2 border-l-2 border-[#1A202C] opacity-20 z-10"></div>
  <div class="absolute bottom-8 right-8 w-10 h-10 border-b-2 border-r-2 border-[#1A202C] opacity-20 z-10"></div>

  <div class="${containerClass} py-8">
    ${imagesHtml}
  </div>

  <div class="absolute bottom-8 right-10 z-20 text-right">
    <div class="text-[14px] font-sans font-bold tracking-[0.3em] text-[#1A202C] opacity-40 uppercase">
      Sales Flyer Data
    </div>
  </div>

</div>`;
}