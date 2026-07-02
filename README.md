# Grammar Trainer

日本語の短文を見て、中国語・ヒンディー語・スペイン語で手入力回答する、個人学習用の文法練習アプリのMVPです。

## 起動方法

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

Gemini API を使うため、`.env.local` に `GEMINI_API_KEY` を設定してください。デフォルトは速度優先の `gemini-3.1-flash-lite` です。精度を優先したい場合などは任意で `GEMINI_MODEL` を指定できます。

スマホで試す場合は、PCとスマホを同じWi-Fiに繋ぎ、`npm run dev -- --hostname 0.0.0.0` で起動して `http://<PCのIPアドレス>:3000` にアクセスしてください。

## できること

- 中国語 / ヒンディー語 / スペイン語の切り替え
- 日本語の例文を見て、手入力で回答
- Gemini API による判定（正解 / 許容 / 惜しい / 不正解）と文法解説（Markdown）の表示
- 回答履歴・単語・文法習得度をブラウザの localStorage に保存（中国語は繁体字、スペイン語単語は小文字で統一）

## 制約

- 認証・クラウドDBは未実装（個人利用ローカルMVP）
- 音声入力には対応していません

## 問題データを増やす

`src/data/curriculum.ts` の `curriculum` 配列に文法項目を追加すると、出題AIが自動で参照します。型定義は `src/types/question.ts` を参照してください。
