import { mergePdfs } from "@/lib/slide-generator/pdf-utils";
import { NextResponse } from "next/server";

/**
 * PDF結合API
 * スライドPDFとマイソクPDFを結合して返す
 */
export async function POST(request: Request) {
	try {
		console.log("[PDF Merge API] Request received");
		const formData = await request.formData();

		// スライドPDFを取得
		const slidesPdfFile = formData.get("slidesPdf");
		console.log("[PDF Merge API] Slides PDF:", slidesPdfFile instanceof File ? `${slidesPdfFile.name} (${slidesPdfFile.size} bytes)` : "Not a file");
		if (!slidesPdfFile || !(slidesPdfFile instanceof File)) {
			return NextResponse.json(
				{ error: "Missing slides PDF" },
				{ status: 400 },
			);
		}

		// マイソクPDFを取得
		const flyerPdfFile = formData.get("flyerPdf");
		console.log("[PDF Merge API] Flyer PDF:", flyerPdfFile instanceof File ? `${flyerPdfFile.name} (${flyerPdfFile.size} bytes)` : "Not a file");
		if (!flyerPdfFile || !(flyerPdfFile instanceof File)) {
			return NextResponse.json(
				{ error: "Missing flyer PDF" },
				{ status: 400 },
			);
		}

		// PDFをバイト配列に変換
		console.log("[PDF Merge API] Converting to byte arrays...");
		const slidesPdfBytes = new Uint8Array(
			await slidesPdfFile.arrayBuffer(),
		);
		const flyerPdfBytes = new Uint8Array(await flyerPdfFile.arrayBuffer());
		console.log("[PDF Merge API] Slides PDF bytes:", slidesPdfBytes.length);
		console.log("[PDF Merge API] Flyer PDF bytes:", flyerPdfBytes.length);

		// PDFを結合
		console.log("[PDF Merge API] Merging PDFs...");
		const mergedPdfBytes = await mergePdfs(slidesPdfBytes, flyerPdfBytes);
		console.log("[PDF Merge API] Merged PDF bytes:", mergedPdfBytes.length);

		// 結合したPDFを返す（BufferまたはArrayBufferに変換）
		return new NextResponse(Buffer.from(mergedPdfBytes), {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": 'attachment; filename="presentation.pdf"',
			},
		});
	} catch (error) {
		console.error("[PDF Merge] Error:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
