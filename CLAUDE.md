@AGENTS.md

# lang-study-app

言語学習アプリ（Next.js 16 / React 19 / TypeScript / Tailwind 4）。
Gemini API で問題生成・採点を行う。

## コマンド
- `npm run dev` — 開発サーバー起動
- `npm run build` — 本番ビルド
- `npm run lint` — ESLint

## 構成
- `src/app/api/generate/route.ts` — 問題生成API
- `src/app/api/grade/route.ts` — 採点API
- `src/components/` — QuestionCard, SpeechInput, ResultPanel など UI
- `src/lib/` — 採点ロジック・習熟度ストア・出題選択
- `src/data/curriculum.ts` — カリキュラム定義

## 注意
- `.env.local` に API キーがある。読まない・コミットしない（.gitignore 済み）。
- UI 文言は日本語。コードコメントは英語。
