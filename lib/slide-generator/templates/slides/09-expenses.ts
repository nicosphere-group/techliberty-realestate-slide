/**
 * 9. Expenses（諸費用）テンプレート - Refined
 * コンセプト: Formal Statement（正式な見積書スタイル）
 * 物件価格の6%〜10%で諸費用を計算
 */

import type { ExpensesContent } from "../../schemas/slide-content";
import {
	escapeHtml,
	NUMBER_FONT_STYLE,
	SLIDE_CONTAINER_CLASS,
} from "../design-system";

/**
 * 金額をフォーマット（万円単位、カンマ区切り）
 */
function formatAmount(amount: number): string {
	return Math.round(amount).toLocaleString("ja-JP");
}

export function renderExpensesSlide(content: ExpensesContent): string {
	// 物件価格から諸費用を計算（6%〜10%）
	const propertyPrice = content.propertyPrice ?? 0;
	const hasPropertyPrice = propertyPrice > 0;
	const minExpense = hasPropertyPrice ? Math.round(propertyPrice * 0.06) : 0;
	const maxExpense = hasPropertyPrice ? Math.round(propertyPrice * 0.1) : 0;

	// 諸費用リストの生成
	// 2列レイアウトにするため、項目を生成（CSS Gridで流し込む想定）
	const expensesHtml = content.expenses
		.map(
			(
				expense,
			) => `<div class="flex justify-between items-baseline border-b border-[#E2E8F0] py-4">
      <span class="text-[22px] font-sans font-medium text-[#2D3748]">
        ${escapeHtml(expense.item)}
      </span>
      <span class="text-[28px] font-serif font-medium text-[#1A202C] tabular-nums" style="${NUMBER_FONT_STYLE}">
        ${escapeHtml(expense.amount)}
      </span>
    </div>`,
		)
		.join("\n");

	return `<div id="slide-container" class="${SLIDE_CONTAINER_CLASS} bg-gradient-to-br from-[#FDFCFB] to-[#F7F5F2] text-[#2D3748] px-20 py-14 flex flex-col" style="font-family: 'Noto Serif JP', 'Playfair Display', serif;">

  <header class="flex-shrink-0 mb-8 relative z-10">
    <div class="flex items-center gap-4 mb-5">
      <div class="h-[2px] w-12 bg-[#C5A059]"></div>
      <span class="text-[16px] font-sans font-bold uppercase tracking-[0.25em] text-[#C5A059]">Initial Costs</span>
    </div>
    <div class="flex justify-between items-end">
      <h1 class="text-[72px] font-serif font-bold leading-none tracking-tight text-[#1A202C]">
        諸費用の合計目安と項目一覧
      </h1>
      <div class="text-right">
        <p class="text-[18px] font-sans text-[#718096]">
          諸費用概算・内訳書
        </p>
      </div>
    </div>
  </header>

  <main class="flex-1 min-h-0 flex flex-col gap-10 relative z-10">
    
    <section class="bg-white border-l-4 border-[#C5A059] shadow-sm p-10 flex items-center justify-between relative overflow-hidden">
      <div class="flex flex-col gap-2 relative z-10">
        <div class="flex items-center gap-3">
          <span class="text-[#C5A059] text-[24px]">■</span>
          <span class="text-[26px] font-sans font-bold text-[#2D3748]">諸費用の合計（概算）</span>
        </div>
        <p class="text-[16px] font-sans text-[#718096] ml-9">
          ※一般的に物件価格の6%〜10%程度
        </p>
      </div>

      ${
				hasPropertyPrice
					? `
      <div class="flex items-baseline gap-2 relative z-10">
        <span class="text-[20px] font-sans text-[#718096]">約</span>
        <span class="text-[72px] font-serif font-bold text-[#C5A059] leading-none tracking-tight" style="${NUMBER_FONT_STYLE}">
          ${formatAmount(minExpense)}
        </span>
        <span class="text-[24px] font-sans text-[#718096]">万円</span>
        <span class="text-[36px] font-serif text-[#A0AEC0] mx-4" style="${NUMBER_FONT_STYLE}">〜</span>
        <span class="text-[20px] font-sans text-[#718096]">約</span>
        <span class="text-[72px] font-serif font-bold text-[#C5A059] leading-none tracking-tight" style="${NUMBER_FONT_STYLE}">
          ${formatAmount(maxExpense)}
        </span>
        <span class="text-[24px] font-sans text-[#718096]">万円</span>
      </div>
      `
					: `
      <div class="flex items-baseline gap-2 relative z-10">
        <span class="text-[72px] font-serif font-bold text-[#1A202C] leading-none tracking-tight">
          物件価格の約
        </span>
        <span class="text-[72px] font-serif font-bold text-[#1A202C] leading-none tracking-tight" style="${NUMBER_FONT_STYLE}">
          6〜10
        </span>
        <span class="text-[30px] font-sans font-medium text-[#718096]">%程度</span>
      </div>
      `
			}

      <div class="absolute -right-10 -bottom-10 text-[200px] font-serif text-[#C5A059] opacity-[0.05] italic pointer-events-none">
        Total
      </div>
    </section>

    <section class="flex-1 bg-white border border-[#E2E8F0] shadow-sm p-10 flex flex-col">
      <div class="flex justify-between items-end mb-5 border-b-2 border-[#1A202C] pb-3">
        <span class="text-[16px] font-sans font-bold tracking-[0.1em] text-[#1A202C] uppercase">費用項目</span>
        <span class="text-[16px] font-sans font-bold tracking-[0.1em] text-[#1A202C] uppercase">金額</span>
      </div>

      <div class="flex-1 overflow-y-auto pr-3 custom-scrollbar">
        <div class="grid grid-cols-2 gap-x-20 gap-y-1">
          ${expensesHtml}
        </div>
      </div>
      
      ${
				content.totalDescription
					? `<div class="mt-8 pt-5 border-t border-[#E2E8F0] flex gap-5">
          <div class="w-1.5 h-auto bg-[#E2E8F0]"></div>
          <p class="text-[16px] font-sans text-[#718096] leading-relaxed max-w-4xl">
            ${escapeHtml(content.totalDescription)}
          </p>
        </div>`
					: ""
			}
    </section>

  </main>

  <footer class="flex-shrink-0 mt-5 text-right">
    ${
			content.note
				? `<p class="text-[14px] font-sans text-[#A0AEC0]">
        ${escapeHtml(content.note)}
      </p>`
				: `<p class="text-[14px] font-sans text-[#A0AEC0]">
        ※上記は概算であり、税制改正や金融機関の条件変更により金額が変動する場合があります。
        仲介手数料は、売買契約締結時に半金、引渡時に残金のお支払いとなります。
      </p>`
		}
  </footer>
</div>`;
}
