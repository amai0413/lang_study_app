import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { TargetLanguage, Level } from "@/types/question";

// 採点 + 回答を踏まえた解説を1回で生成する。
// 解説③はユーザーの回答に即した内容にする。解説フォーマットは固定して再現性を保つ。
const SYSTEM_PROMPT = `あなたは言語学習アプリの採点・文法解説の専門家です。
学習者の回答を採点し、その回答を踏まえた詳しい文法解説を日本語で書きます。

必ず以下のJSON形式のみで返答してください。コードフェンスや前置きは不要です。

{
  "status": "correct | acceptable | close | incorrect",
  "feedback": "短い判定コメント（1〜2文）",
  "betterExpression": "より自然な言い方（statusがacceptable/closeのときのみ。correctのときは空文字）",
  "explanationMarkdown": "下記テンプレートに厳密に従った解説",
  "words": [
    { "surface": "単語", "reading": "読み方（ピンインやローマ字）", "meaning": "日本語の意味", "pos": "品詞" }
  ],
  "grammarItems": ["この問題で使われた文法・構文の名前（例: 動詞+目的語の語順, 疑問助詞嗎）"]
}

【採点基準（重要）】
- correct: acceptedAnswers のいずれかと実質同じ、または完全に正しく自然な回答
- acceptable: 文法的に正しく意味も通じるが、より自然な言い方が存在する（別の正しい表現）。betterExpression により自然な形を入れる
- close: 意味は伝わるが誤りがある（語順・助詞・活用・語彙の軽い間違いなど）
- incorrect: 意味が通じない、または大きく誤っている

同じ意味の別表現を安易に incorrect にしないこと。通じるなら acceptable か close にする。

【explanationMarkdown テンプレート（見出しを変えない）】

# 文法解説

## 例文
**[目標言語の自然な正解文]**

## ① 日本語訳
**自然な訳：** [自然な意味]
> 直訳：[語順通りの直訳]

## ② 単語解説
| 単語 | 読み方 | 品詞 | 意味 | 補足 |
| --- | --- | --- | --- | --- |
| [単語] | [読み] | [品詞] | [意味] | [補足] |

## ③ あなたの回答について
学習者の回答「[ユーザーの回答]」を引用し、どこが正しく、どこが間違っていたかを具体的に指摘する。
別の正しい言い方だった場合は「正しいですが、より自然なのは〜」と伝える。
正しい構文の仕組みと、日本語との語順・発想の違いを2〜3段落で説明する。

## ④ 覚えておきたい構文
**[文法パターン]**

意味：「[パターンの意味]」

例：
- [例文1]　[日本語訳]
- [例文2]　[日本語訳]
- [例文3]　[日本語訳]

## ⑤ 学習ポイントと復習
- [キーワード] = [意味]
- [重要な文法ポイント]
- 今回の回答を踏まえ、特に復習すべき点を1〜2個挙げる`;

const client = new Anthropic();

function extractJSON(text: string): string {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fence?.[1]) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && start < end) t = t.slice(start, end + 1);
  return t;
}

interface GradeBody {
  targetLanguage?: TargetLanguage;
  level?: Level;
  japanesePrompt?: string;
  strictAnswer?: string;
  acceptedAnswers?: string[];
  grammarPoint?: string;
  userAnswer?: string;
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません。" }, { status: 500 });
  }

  let body: GradeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました。" }, { status: 400 });
  }

  const { targetLanguage, level, japanesePrompt, strictAnswer, acceptedAnswers, grammarPoint, userAnswer } = body;
  if (!targetLanguage || !japanesePrompt || !strictAnswer || !userAnswer) {
    return NextResponse.json({ error: "必須フィールドが不足しています。" }, { status: 400 });
  }

  const langLabel = targetLanguage === "zh" ? "中国語" : "ヒンディー語";

  const userMessage = `以下の練習問題を採点し、回答を踏まえた解説を作成してください。

言語: ${langLabel}
難易度: ${level ?? "A1"}
日本語文: ${japanesePrompt}
模範解答: ${strictAnswer}
${acceptedAnswers?.length ? `正解バリエーション: ${acceptedAnswers.join("、")}` : ""}
文法パターン: ${grammarPoint ?? "（指定なし）"}

学習者の回答: ${userAnswer}

この回答を採点し、指定のJSON形式で返してください。解説③は必ず学習者の回答を引用して具体的に説明すること。`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2560,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "採点が拒否されました。" }, { status: 422 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "レスポンスが空でした。" }, { status: 500 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJSON(textBlock.text));
    } catch {
      console.error("[/api/grade] raw:", textBlock.text.slice(0, 400));
      return NextResponse.json({ error: "採点結果の解析に失敗しました。" }, { status: 500 });
    }

    if (!parsed.status || !parsed.explanationMarkdown) {
      return NextResponse.json({ error: "採点結果が不完全です。" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[/api/grade]", error);
    return NextResponse.json({ error: "採点中にエラーが発生しました。" }, { status: 500 });
  }
}
