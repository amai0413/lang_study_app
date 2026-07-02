import { NextRequest, NextResponse } from "next/server";
import { parseAIJSON } from "@/lib/aiJson";
import { generateGeminiText, hasGeminiApiKey } from "@/lib/gemini";
import { LANGUAGE_LABELS, isTargetLanguage, targetLanguageListLabel } from "@/lib/languages";
import type { TargetLanguage, Level } from "@/types/question";

// 採点 + 回答を踏まえた解説を1回で生成する。
// 解説③はユーザーの回答に即した内容にする。解説フォーマットは固定して再現性を保つ。
const SYSTEM_PROMPT = `あなたは言語学習アプリの採点・文法解説の専門家です。
学習者の回答を採点し、その回答を踏まえた文法解説を日本語で書きます。

必ず以下のJSON形式のみで返答してください。コードフェンスや前置きは不要です。

{
  "status": "correct | acceptable | close | incorrect",
  "feedback": "短い判定コメント（1〜2文）",
  "betterExpression": "より自然な言い方（statusがacceptable/closeのときのみ。correctのときは空文字）",
  "explanationMarkdown": "下記テンプレートに厳密に従った解説",
  "words": [
    { "surface": "単語", "reading": "読み方（ピンインやローマ字。スペイン語の場合は英語での意味）", "meaning": "日本語の意味", "pos": "品詞" }
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
学習者の回答「[ユーザーの回答]」を引用し、どこが正しく、どこが間違っていたかを具体的に指摘する。2〜3段落に収める。

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

const GRADE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["correct", "acceptable", "close", "incorrect"] },
    feedback: { type: "string" },
    betterExpression: { type: "string" },
    explanationMarkdown: { type: "string" },
    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          surface: { type: "string" },
          reading: { type: "string" },
          meaning: { type: "string" },
          pos: { type: "string" },
        },
        required: ["surface", "reading", "meaning", "pos"],
        propertyOrdering: ["surface", "reading", "meaning", "pos"],
      },
    },
    grammarItems: { type: "array", items: { type: "string" } },
  },
  required: ["status", "feedback", "betterExpression", "explanationMarkdown", "words", "grammarItems"],
  propertyOrdering: [
    "status",
    "feedback",
    "betterExpression",
    "explanationMarkdown",
    "words",
    "grammarItems",
  ],
};

interface GradeBody {
  targetLanguage?: TargetLanguage;
  level?: Level;
  japanesePrompt?: string;
  strictAnswer?: string;
  acceptedAnswers?: string[];
  grammarPoint?: string;
  userAnswer?: string;
}

function normalizeSpanishExplanationMarkdown(markdown: unknown): unknown {
  if (typeof markdown !== "string") return markdown;
  return markdown
    .replace(/\|\s*読み方\s*\|/g, "| 英語の意味 |")
    .replace(/\|\s*\[読み\]\s*\|/g, "| [英語の意味] |");
}

export async function POST(request: NextRequest) {
  if (!hasGeminiApiKey()) {
    return NextResponse.json({ error: "GEMINI_API_KEY が設定されていません。" }, { status: 500 });
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
  if (!isTargetLanguage(targetLanguage)) {
    return NextResponse.json(
      { error: `targetLanguage に ${targetLanguageListLabel()} のいずれかを指定してください。` },
      { status: 400 },
    );
  }

  const langLabel = LANGUAGE_LABELS[targetLanguage];
  const readingInstruction =
    targetLanguage === "es"
      ? "words[].reading と単語解説表の第2列には、発音ではなく英語での意味を入れてください（例: soy -> I am, casa -> house）。explanationMarkdown の単語解説表の第2列見出しは必ず「英語の意味」にし、「読み方」という見出しは使わないでください。"
      : "words[].reading と単語解説表の「読み方」列には、読み方を入れてください（中国語はピンイン、ヒンディー語はローマ字）。";

  const userMessage = `以下の練習問題を採点し、回答を踏まえた解説を作成してください。

言語: ${langLabel}
難易度: ${level ?? "A1"}
日本語文: ${japanesePrompt}
模範解答: ${strictAnswer}
${acceptedAnswers?.length ? `正解バリエーション: ${acceptedAnswers.join("、")}` : ""}
文法パターン: ${grammarPoint ?? "（指定なし）"}

学習者の回答: ${userAnswer}

単語欄の指示: ${readingInstruction}

この回答を採点し、指定のJSON形式で返してください。解説③は必ず学習者の回答を引用して具体的に説明すること。`;

  try {
    const text = await generateGeminiText({
      maxOutputTokens: 4096,
      responseSchema: GRADE_RESPONSE_SCHEMA,
      systemInstruction: SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.1,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = parseAIJSON(text);
    } catch {
      console.error("[/api/grade] raw:", text.slice(0, 400));
      return NextResponse.json({ error: "採点結果の解析に失敗しました。" }, { status: 500 });
    }

    if (targetLanguage === "es") {
      parsed.explanationMarkdown = normalizeSpanishExplanationMarkdown(parsed.explanationMarkdown);
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
