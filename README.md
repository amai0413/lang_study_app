# Voice Grammar Trainer

日本語の短文を見て、中国語またはヒンディー語で（音声 or 手入力で）回答する、個人学習用の文法練習アプリのMVPです。

## 起動方法

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

スマホで試す場合は、PCとスマホを同じWi-Fiに繋ぎ、`npm run dev -- --hostname 0.0.0.0` で起動して `http://<PCのIPアドレス>:3000` にアクセスしてください（音声認識はHTTPS環境でしか動かないブラウザもあります）。

## できること

- 中国語 / ヒンディー語の切り替え
- 日本語の例文を見て、音声入力（Web Speech API）または手入力で回答
- ルールベースの判定（正解 / 惜しい / 不正解）と文法解説（Markdown）の表示
- 回答履歴をブラウザの localStorage に保存

## 制約

- 認証・課金・クラウドDB・外部AI APIは未実装（個人利用ローカルMVP）
- 音声認識に対応していないブラウザでは自動的に手入力のみの表示に切り替わります

## 問題データを増やす

`src/data/questions.ts` の配列に `Question` オブジェクトを追加するだけで問題が増やせます。型定義は `src/types/question.ts` を参照してください。
