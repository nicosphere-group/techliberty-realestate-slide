# TechLiberty - Real Estate Slide Generator

AIを活用して不動産チラシ情報からプレゼンテーションスライドを自動生成するNext.jsアプリケーションです。

## 🚀 プロジェクト概要

このアプリケーションは、不動産の物件情報を入力（またはチラシ解析）し、Gemini 3モデルを使用して高品質なスライドデッキを生成します。

- **AI駆動**: Vercel AI SDKとGemini 3 Flash Previewを使用
- **ストリーミング生成**: 生成プロセスをリアルタイムで可視化
- **スライドプレビュー**: 実際の1920x1080解像度でのプレビュー（iframe分離レンダリング）
- **PPTXエクスポート**: 生成されたHTML/CSSスライドをPowerPoint形式でダウンロード

## 🛠 テクノロジースタック

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **UI**: React 19, [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/docs), Google Generative AI
- **Forms**: @tanstack/react-form, Zod
- **Export**: dom-to-pptx
- **Linting**: [Biome](https://biomejs.dev/)

## 🏁 開発の始め方

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd techliberty-realestate-slide
npm install
```

### 2. 環境変数の設定

ルートディレクトリに `.env.local` ファイルを作成し、Google AI StudioのAPIキーを設定してください。

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて確認してください。

## 📜 スクリプト

- `npm run dev`: 開発サーバーを起動
- `npm run build`: 本番用にビルド
- `npm run start`: ビルドされたアプリケーションを実行
- `npm run lint`: Biomeを使用してコードのLintとフォーマットチェックを実行

## 📁 ディレクトリ構成

- `app/`: Next.js App Router (ページ、Server Actions)
- `components/`: UIコンポーネント
  - `components/ui/`: shadcn/ui コンポーネント
- `lib/slide-generator/`: スライド生成のコアドメインロジック
- `types/`: 型定義ファイル

## 💡 主要なコンセプト

### スライド生成エンジン (`lib/slide-generator/`)
`SlideGenerator` クラスがスライド生成のオーケストレーションを行います。`async generator` パターンを使用し、生成の進捗状況（プランニング、リサーチ、生成など）をクライアントにストリーミングします。

### レンダリングと隔離
生成されたスライドは、スタイル汚染を防ぎ、PPTXエクスポートの忠実性を保つために、自己完結型のHTML文字列として扱われ、`iframe` 内でレンダリングされます。Tailwind CSS v4のCDN版が各スライドに埋め込まれています。
