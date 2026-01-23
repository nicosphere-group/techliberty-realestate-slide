/**
 * 12. Flyer（マイソク）テンプレート - 静的版
 * マイソク画像を大きく表示するシンプルなデザイン
 *
 * このスライドは静的なテンプレートです。
 * LLMによるコンテンツ生成は不要です。
 * 画像URLのみ外部から渡されます。
 */

import { escapeHtml, SLIDE_CONTAINER_CLASS } from "../design-system";

export function renderFlyerSlide(imageUrls: string[]): string {
	// 画像がない場合のフォールバック
	if (imageUrls.length === 0) {
		return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] flex items-center justify-center">
      <div class="text-center">
        <div class="text-[100px] text-[#E2E8F0] mb-6">■</div>
        <p class="text-3xl font-serif text-[#A0AEC0] tracking-widest">NO FLYER IMAGE</p>
      </div>
    </div>`;
	}

	// 画像生成ロジック
	let imagesHtml = "";

	if (imageUrls.length === 1) {
		// 【単一画像モード】画像を大きく中央表示
		imagesHtml = `
      <div class="flex-1 min-h-0 flex items-center justify-center">
        <img
          src="${escapeHtml(imageUrls[0])}"
          alt="マイソク"
          class="max-w-full max-h-full object-contain shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-[#E2E8F0]"
        />
      </div>
    `;
	} else {
		// 【複数画像モード】2枚なら左右分割、3枚以上ならグリッド
		const gridClass =
			imageUrls.length === 2 ? "grid-cols-2 gap-8" : "grid-cols-3 gap-6";

		const items = imageUrls
			.map(
				(url) =>
					`<div class="flex items-center justify-center overflow-hidden bg-white border border-[#E2E8F0] shadow-md p-4">
         <img src="${escapeHtml(url)}" alt="マイソク" class="max-w-full max-h-full object-contain" />
       </div>`,
			)
			.join("\n");

		imagesHtml = `<div class="flex-1 min-h-0 grid ${gridClass}">${items}</div>`;
	}

	return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <!-- 水平線デコレーション -->
  <div class="absolute top-[140px] left-0 w-full h-[1px] bg-[#E2E8F0] pointer-events-none"></div>

  <!-- ヘッダー -->
  <header class="flex-shrink-0 mb-8 relative z-10">
    <div class="flex items-center gap-4 mb-5">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Sales Flyer</span>
    </div>
    <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
      マイソク
    </h1>
  </header>

  <!-- メインコンテンツ -->
  <main class="flex-1 min-h-0 flex flex-col relative z-10">
    ${imagesHtml}
  </main>

</div>`;
}
