/**
 * PDF → JPG 変換ユーティリティ
 * PDF.js を使用して PDF の各ページを JPG 画像に変換
 *
 * 特徴:
 * - 各ページを個別のJPGファイルに変換
 * - 最大幅1440pxにリサイズ
 * - 文字化け対策（cMap、フォント設定）
 * - 詳細なエラーハンドリング
 */

// PDF.js は動的にインポート（サーバーサイドでの DOMMatrix エラーを回避）
let pdfjsLib: typeof import("pdfjs-dist") | null = null;

// PDF.js のワーカーを設定（ブラウザ環境のみ）
let workerInitialized = false;

async function initializePdfWorker() {
  if (typeof window === "undefined") {
    throw new Error("PDF conversion is only supported in browser environment");
  }

  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist");
  }

  if (!workerInitialized) {
    // Module Worker を静的に解決可能な形で生成（public フォルダから読み込み）
    const worker = new Worker("/pdf-worker/pdf.worker.min.mjs", {
      type: "module",
    });
    pdfjsLib.GlobalWorkerOptions.workerPort = worker;
    workerInitialized = true;
  }

  return pdfjsLib;
}

/**
 * ページ情報の型定義
 */
export interface PdfPageInfo {
  pageNum: number;
  file: File;
  width: number;
  height: number;
}

/**
 * PDF変換結果の型定義
 */
export interface PdfConversionResult {
  pages: PdfPageInfo[];
  totalPages: number;
}

/**
 * PDF ファイルを JPG 画像に変換
 * 各ページを個別のJPGファイルとして返す（連結なし）
 *
 * @param pdfFile - PDF ファイル
 * @param maxWidth - 最大幅（ピクセル、デフォルト: 1440）
 * @param quality - JPEG 品質 (0-1, デフォルト: 0.85)
 * @returns 各ページのJPGファイル配列
 */
export async function convertPdfToJpg(pdfFile: File, maxWidth = 1440, quality = 0.85): Promise<PdfConversionResult> {
  try {
    // PDF.js Workerを初期化（サーバーサイドではエラーをスロー）
    const pdfjs = await initializePdfWorker();

    // PDF を読み込み（文字化け対策の設定を追加）
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data: arrayBuffer,
      // 文字化け対策の設定（publicフォルダーから読み込み）
      cMapUrl: "/cmaps/",
      cMapPacked: true,
      // フォント埋め込みを有効化
      disableFontFace: false,
      // 文字エンコーディングの設定（publicフォルダーから読み込み）
      standardFontDataUrl: "/standard_fonts/",
      // レンダリング品質の向上
      verbosity: 0,
    }).promise;

    const numPages = pdf.numPages;
    const pageImages: Array<{
      canvas: HTMLCanvasElement;
      width: number;
      height: number;
    }> = [];

    // 各ページを処理
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);

      // ページのビューポートを取得（高解像度化）
      const viewport = page.getViewport({ scale: 2.0 });

      // リサイズ処理（横幅のみをチェック）
      let { width, height } = viewport;

      if (width > maxWidth) {
        const ratio = maxWidth / width;
        height = height * ratio;
        width = maxWidth;
      }

      // Canvas を作成
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("キャンバスコンテキストの取得に失敗しました");
      }

      canvas.width = width;
      canvas.height = height;

      // リサイズされたビューポートを作成
      const resizedViewport = page.getViewport({
        scale: Math.min(width / viewport.width, height / viewport.height) * 2.0,
      });

      // ページを Canvas にレンダリング
      const renderContext = {
        canvasContext: context,
        viewport: resizedViewport,
      } as any; // PDF.js の型定義が不完全なため
      await page.render(renderContext).promise;

      pageImages.push({
        canvas,
        width,
        height,
      });
    }

    // 各ページを個別のFileオブジェクトに変換
    const originalName = pdfFile.name.replace(/\.pdf$/i, "");
    const pages: PdfPageInfo[] = [];

    for (let i = 0; i < pageImages.length; i++) {
      const pageImage = pageImages[i];

      // ページごとのBlob作成
      const blob = await new Promise<Blob>((resolve, reject) => {
        pageImage.canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error(`ページ${i + 1}のJPEG変換に失敗しました`));
            }
          },
          "image/jpeg",
          quality
        );
      });

      // Fileオブジェクト作成
      const fileName = `${originalName}-page-${i + 1}.jpg`;
      const file = new File([blob], fileName, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      pages.push({
        pageNum: i + 1,
        file,
        width: pageImage.width,
        height: pageImage.height,
      });
    }

    return {
      pages,
      totalPages: pageImages.length,
    };
  } catch (error) {
    console.error("PDF変換エラー:", error);

    // より詳細なエラー情報を提供
    if (error instanceof Error) {
      if (error.name === "InvalidPDFException") {
        throw new Error("PDFファイルが破損しているか、無効な形式です。");
      }
      if (error.name === "MissingPDFException") {
        throw new Error("PDFファイルが見つかりません。");
      }
      if (error.name === "UnexpectedResponseException") {
        throw new Error("PDFファイルの読み込みに失敗しました。ファイルが正しくアップロードされているか確認してください。");
      }
      if (error.message && error.message.includes("font")) {
        throw new Error("PDFのフォント処理でエラーが発生しました。文字化けの原因となる可能性があります。");
      }
      throw new Error(`PDFの変換に失敗しました: ${error.message || "不明なエラー"}`);
    }
    throw new Error("PDFの変換に失敗しました: 不明なエラー");
  }
}

/**
 * PDF ファイルを1枚の縦長JPG画像に変換（全ページを縦に連結）
 *
 * @param pdfFile - PDF ファイル
 * @param maxWidth - 最大幅（ピクセル、デフォルト: 1440）
 * @param quality - JPEG 品質 (0-1, デフォルト: 0.85)
 * @returns 連結されたJPGファイルと総ページ数
 */
export async function convertPdfToSingleJpg(
  pdfFile: File,
  maxWidth = 1440,
  quality = 0.85
): Promise<{ file: File; totalPages: number; width: number; height: number }> {
  try {
    const pdfjs = await initializePdfWorker();

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data: arrayBuffer,
      cMapUrl: "/cmaps/",
      cMapPacked: true,
      disableFontFace: false,
      standardFontDataUrl: "/standard_fonts/",
      verbosity: 0,
    }).promise;

    const numPages = pdf.numPages;
    const pageCanvases: Array<{
      canvas: HTMLCanvasElement;
      width: number;
      height: number;
    }> = [];

    // 各ページをレンダリング
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      let { width, height } = viewport;

      if (width > maxWidth) {
        const ratio = maxWidth / width;
        height = height * ratio;
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("キャンバスコンテキストの取得に失敗しました");
      }

      canvas.width = width;
      canvas.height = height;

      const resizedViewport = page.getViewport({
        scale: Math.min(width / viewport.width, height / viewport.height) * 2.0,
      });

      const renderContext = {
        canvasContext: context,
        viewport: resizedViewport,
      } as any;
      await page.render(renderContext).promise;

      pageCanvases.push({ canvas, width, height });
    }

    // 全ページを縦に連結
    const finalWidth = Math.max(...pageCanvases.map((p) => p.width));
    const finalHeight = pageCanvases.reduce((sum, p) => sum + p.height, 0);

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = finalWidth;
    finalCanvas.height = finalHeight;

    const finalContext = finalCanvas.getContext("2d");
    if (!finalContext) {
      throw new Error("最終キャンバスコンテキストの取得に失敗しました");
    }

    // 白背景を描画
    finalContext.fillStyle = "#ffffff";
    finalContext.fillRect(0, 0, finalWidth, finalHeight);

    // 各ページを縦に配置
    let currentY = 0;
    for (const pageCanvas of pageCanvases) {
      // 中央揃え
      const offsetX = (finalWidth - pageCanvas.width) / 2;
      finalContext.drawImage(pageCanvas.canvas, offsetX, currentY);
      currentY += pageCanvas.height;
    }

    // Blob → File 変換
    const blob = await new Promise<Blob>((resolve, reject) => {
      finalCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("JPEG変換に失敗しました"));
          }
        },
        "image/jpeg",
        quality
      );
    });

    const originalName = pdfFile.name.replace(/\.pdf$/i, "");
    const file = new File([blob], `${originalName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    return {
      file,
      totalPages: numPages,
      width: finalWidth,
      height: finalHeight,
    };
  } catch (error) {
    console.error("PDF変換エラー:", error);

    if (error instanceof Error) {
      if (error.name === "InvalidPDFException") {
        throw new Error("PDFファイルが破損しているか、無効な形式です。");
      }
      if (error.name === "MissingPDFException") {
        throw new Error("PDFファイルが見つかりません。");
      }
      if (error.name === "UnexpectedResponseException") {
        throw new Error("PDFファイルの読み込みに失敗しました。");
      }
      throw new Error(`PDFの変換に失敗しました: ${error.message || "不明なエラー"}`);
    }
    throw new Error("PDFの変換に失敗しました: 不明なエラー");
  }
}

/**
 * ファイルが PDF かどうかを判定
 *
 * @param file - チェックするファイル
 * @returns PDF の場合 true
 */
export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * PDF のページ数を取得
 *
 * @param pdfFile - PDF ファイル
 * @returns ページ数
 */
export async function getPdfPageCount(pdfFile: File): Promise<number> {
  const pdfjs = await initializePdfWorker();
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}
