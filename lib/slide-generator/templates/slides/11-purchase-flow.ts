/**
 * 11. Purchase Flow（購入手続き）テンプレート - 静的版
 * コンセプト: Concierge Roadmap（上質なロードマップ）
 *
 * このスライドは完全に静的なテンプレートです。
 * LLMによるコンテンツ生成は不要です。
 */

import { SLIDE_CONTAINER_CLASS } from "../design-system";

/** 静的な購入フローステップ */
const PURCHASE_STEPS = [
	{
		title: "購入申込",
		description: "気に入った物件が見つかったら、購入申込書を提出します。",
		checkItems: ["購入申込書の記入", "申込金の準備"],
	},
	{
		title: "住宅ローン事前審査",
		description: "金融機関に事前審査を申し込み、借入可能額を確認します。",
		checkItems: ["必要書類の準備", "金融機関の選定"],
	},
	{
		title: "売買契約締結",
		description:
			"重要事項説明を受け、売買契約を締結します。手付金をお支払いいただきます。",
		checkItems: ["重要事項説明の確認", "手付金のご用意"],
	},
	{
		title: "住宅ローン本審査",
		description: "売買契約後、金融機関の本審査を受けます。",
		checkItems: ["本審査書類の提出", "団信への加入"],
	},
	{
		title: "金銭消費貸借契約",
		description: "住宅ローンの正式な契約を金融機関と締結します。",
		checkItems: ["契約内容の最終確認", "印鑑証明書等の準備"],
	},
	{
		title: "決済・引渡し",
		description: "残代金の支払いと同時に、物件の引渡しを受けます。",
		checkItems: ["残代金・諸費用の準備", "鍵の受け取り"],
	},
] as const;

export function renderPurchaseFlowSlide(): string {
	const stepsHtml = PURCHASE_STEPS.map((step, index) => {
		const checkItemsHtml = step.checkItems
			.map(
				(
					item,
				) => `<li class="flex items-start gap-3 text-[18px] text-[#4A5568] font-sans leading-[1.6]">
          <span class="w-1.5 h-1.5 bg-[#C5A059] mt-[10px] rounded-full flex-shrink-0"></span>
          <span>${item}</span>
        </li>`,
			)
			.join("\n");

		return `<div class="relative bg-white border border-[#E2E8F0] p-8 flex flex-col h-full">
        <div class="absolute top-4 right-6 text-[100px] font-serif font-bold text-[#F7F5F2] leading-none pointer-events-none">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <div class="relative z-10 mb-5">
          <span class="text-[14px] font-sans font-bold tracking-[0.2em] text-[#C5A059] uppercase block mb-2">ステップ ${index + 1}</span>
          <h3 class="text-[28px] font-serif font-bold text-[#1A202C] leading-tight">
            ${step.title}
          </h3>
        </div>

        <div class="relative z-10 flex-1 flex flex-col">
          <div class="w-12 h-[2px] bg-[#C5A059] mb-5"></div>
          <p class="text-[18px] font-sans text-[#718096] mb-5 leading-relaxed">
            ${step.description}
          </p>
          <ul class="space-y-2 bg-[#FAFAFA] p-5 rounded-sm border border-[#F0F0F0] mt-auto">
            ${checkItemsHtml}
          </ul>
        </div>
      </div>`;
	}).join("\n");

	return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-12 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <div class="absolute top-[200px] left-0 w-full h-[1px] bg-[#E2E8F0] pointer-events-none"></div>

  <header class="flex-shrink-0 mb-8 relative z-10">
    <div class="flex items-center gap-4 mb-4">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Process Map</span>
    </div>
    <div class="flex justify-between items-end">
      <div>
        <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C] mb-3">
          ご購入の流れ
        </h1>
        <p class="text-[20px] font-sans text-[#718096]">
          ご購入申し込みからご入居までの標準的な流れ
        </p>
      </div>

      <div class="text-right">
        <div class="text-[14px] font-sans font-bold tracking-[0.1em] text-[#A0AEC0] uppercase mb-2">所要期間の目安</div>
        <div class="flex items-baseline justify-end gap-2 text-[#1A202C]">
          <span class="text-[24px] font-serif">約</span>
          <span class="text-[48px] font-serif font-bold text-[#C5A059]">1~2</span>
          <span class="text-[24px] font-serif">ヶ月</span>
        </div>
      </div>
    </div>
  </header>

  <main class="flex-1 min-h-0 relative z-10">
    <div class="grid grid-cols-3 gap-x-10 gap-y-8 h-full">
      ${stepsHtml}
    </div>
  </main>

  <footer class="flex-shrink-0 mt-6 pt-5 border-t border-[#E2E8F0] flex justify-between items-center">
    <div class="flex items-center gap-3">
      <div class="w-20 h-[2px] bg-[#C5A059]"></div>
      <span class="text-[14px] font-sans tracking-widest text-[#C5A059] uppercase">Successful Closing</span>
    </div>
    <p class="text-[14px] font-sans text-[#A0AEC0]">
      ※スケジュールは物件の状況や審査の進行により前後する場合がございます。
    </p>
  </footer>
</div>`;
}
