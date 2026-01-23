# Copilot Instructions (Tech Liberty Real Estate Slide Generator)

## プロジェクト概要
- Next.js App Routerの単一アプリで、物件情報とチラシ画像からスライドを自動生成する。
- フロントはフォーム入力→SSEストリーミングで生成イベントを受信→iframeで1920x1080のスライドHTMLをプレビュー。

## 主要アーキテクチャ / データフロー
- UI入口は [app/page.tsx](app/page.tsx) → [app/client-page.tsx](app/client-page.tsx)。
- 生成フローはSSE: フォーム送信 → POST /api/generate → `SlideGenerator.run()` のイベントを順次送信。
  - 受信イベント型: `start`, `plan:start/end`, `slide:start/generating/end`, `usage`, `end`, `error`。
  - サーバー側は Hono + `streamSSE` を使用 ([app/api/[[...route]]/route.ts](app/api/%5B%5B...route%5D%5D/route.ts)).
- スライドHTMLは `wrapInHtmlDocument()` で自己完結HTML化し、iframeで隔離表示。
  - 参照: [lib/slide-generator/templates](lib/slide-generator/templates) と [components/slide-preview.tsx](components/slide-preview.tsx)。

## スライド生成のコア仕様
- 固定12枚構成。定義は [lib/slide-generator/config.ts](lib/slide-generator/config.ts)。
- `SlideGenerator` は `AsyncGenerator` でイベントをyieldし、静的テンプレートはLLMをスキップ。
  - 中核実装: [lib/slide-generator/slide-generator.ts](lib/slide-generator/slide-generator.ts)。
- スライド種別ごとのテンプレート/スキーマは [lib/slide-generator/templates](lib/slide-generator/templates) と [lib/slide-generator/schemas](lib/slide-generator/schemas.ts)。

## 外部依存とツール連携
- 画像/地図/価格分析ツールはスライド番号で切替。
  - ツール一覧・マッピング: [lib/slide-generator/tools/index.ts](lib/slide-generator/tools/index.ts)。
- Google Maps/Places/Routes, REINFO API, ハザード/避難所データを利用。
  - 例: 周辺施設/静的地図 [lib/slide-generator/tools/nearby.ts](lib/slide-generator/tools/nearby.ts)、価格分析 [lib/slide-generator/tools/reinfo.ts](lib/slide-generator/tools/reinfo.ts)。
- 生成画像・地図はSupabase Storage(S3互換)へアップロード。
  - アップロード処理: [lib/slide-generator/tools/upload.ts](lib/slide-generator/tools/upload.ts)。

## 必須/主要な環境変数
- `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini/Imagen)
- `GOOGLE_MAPS_API_KEY` (地図・周辺検索)
- `REINFO_API_KEY` (国交省 REINFO)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (Supabase Storage S3互換)

## 開発ワークフロー
- 開発: `npm run dev`
- ビルド: `npm run build`
- 起動: `npm run start`
- Lint/Format: `npm run lint` (Biome)
  - 参照: [package.json](package.json) / [README.md](README.md)

## コード変更時の注意点
- フォーム検証はZodスキーマを起点にする: [app/schemas.ts](app/schemas.ts) → [lib/slide-generator/schemas.ts](lib/slide-generator/schemas.ts)。
- スライドHTMLは必ず `wrapInHtmlDocument()` で閉じたHTMLにし、iframe表示/エクスポート互換を維持。
- React/Next.jsの最適化規約は .github/skills/vercel-react-best-practices を遵守。
