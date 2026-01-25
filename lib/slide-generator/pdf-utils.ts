/**
 * PDF処理ユーティリティ
 * マイソクPDFと結合する
 *
 * Note: HTML→PDF変換はクライアント側で行うため、
 * このモジュールではPDF結合のみを行う
 */

import { PDFDocument } from "pdf-lib";

/**
 * 2つのPDFを結合
 * @param slidesPdfBytes - スライドPDFのバイト配列
 * @param flyerPdfBytes - マイソクPDFのバイト配列
 * @returns 結合されたPDFのバイト配列
 */
export async function mergePdfs(
	slidesPdfBytes: Uint8Array,
	flyerPdfBytes: Uint8Array,
): Promise<Uint8Array> {
	console.log("[PDF Utils] Loading slides PDF...");
	// スライドPDFを読み込み
	const mergedPdf = await PDFDocument.load(slidesPdfBytes);
	console.log("[PDF Utils] Slides PDF loaded, pages:", mergedPdf.getPageCount());

	console.log("[PDF Utils] Loading flyer PDF...");
	// マイソクPDFを読み込み
	const flyerPdf = await PDFDocument.load(flyerPdfBytes);
	console.log("[PDF Utils] Flyer PDF loaded, pages:", flyerPdf.getPageCount());

	// マイソクPDFの全ページをコピーして先頭に挿入
	console.log("[PDF Utils] Copying flyer pages...");
	const flyerPages = await mergedPdf.copyPages(
		flyerPdf,
		flyerPdf.getPageIndices(),
	);
	console.log("[PDF Utils] Inserting flyer pages at the beginning of merged PDF...");
	// 先頭に挿入するため、逆順で0番目に挿入していく
	for (let i = flyerPages.length - 1; i >= 0; i--) {
		mergedPdf.insertPage(0, flyerPages[i]);
	}
	console.log("[PDF Utils] Merged PDF total pages:", mergedPdf.getPageCount());

	// 結合したPDFを保存
	console.log("[PDF Utils] Saving merged PDF...");
	const result = await mergedPdf.save();
	console.log("[PDF Utils] Merged PDF saved, bytes:", result.length);
	return result;
}
