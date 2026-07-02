import { NextRequest, NextResponse } from "next/server";
import { parseAIJSON } from "@/lib/aiJson";
import { generateGeminiText, hasGeminiApiKey } from "@/lib/gemini";
import { LANGUAGE_LABELS, isTargetLanguage, targetLanguageListLabel } from "@/lib/languages";
import { toTraditionalChinese } from "@/lib/textNormalize";
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
    { "surface": "単語", "reading": "読み方（ピンインやローマ字。スペイン語の場合は英語での意味）", "meaning": "日本語の意味", "pos": "品詞", "remembered": true, "correctness": "correct | partial | incorrect", "note": "短い理由" }
  ],
  "grammarItems": ["この問題で使われた文法・構文の名前（例: 動詞+目的語の語順, 疑問助詞嗎）"],
  "answerAssessment": {
    "vocabulary": { "status": "correct | partial | incorrect", "detail": "単語面の具体的評価" },
    "grammar": { "status": "correct | partial | incorrect", "detail": "文法面の具体的評価" },
    "naturalness": { "status": "correct | partial | incorrect", "detail": "自然さの具体的評価" }
  }
}

【採点基準（重要）】
- correct: acceptedAnswers のいずれかと実質同じ、または完全に正しく自然な回答
- acceptable: 文法的に正しく意味も通じるが、より自然な言い方が存在する（別の正しい表現）。betterExpression により自然な形を入れる
- close: 意味は伝わるが誤りがある（語順・助詞・活用・語彙の軽い間違いなど）
- incorrect: 意味が通じない、または大きく誤っている

同じ意味の別表現を安易に incorrect にしないこと。通じるなら acceptable か close にする。

【explanationMarkdown テンプレート（見出しを変えない）】

# 文法解説

## 模範解答の補足
**自然な訳：** [自然な意味]
> 直訳：[語順通りの直訳]

## 1. 単語解説
| 単語 | 読み方 | 品詞 | 意味 | 補足 |
| --- | --- | --- | --- | --- |
| [単語] | [読み] | [品詞] | [意味] | [補足] |

## 2. 覚えておきたい構文
**[文法パターン]**

意味：「[パターンの意味]」

例：
- [例文1]　[日本語訳]
- [例文2]　[日本語訳]

## 3. 学習ポイントと復習
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
          remembered: { type: "boolean" },
          correctness: { type: "string", enum: ["correct", "partial", "incorrect"] },
          note: { type: "string" },
        },
        required: ["surface", "reading", "meaning", "pos", "remembered", "correctness", "note"],
        propertyOrdering: ["surface", "reading", "meaning", "pos", "remembered", "correctness", "note"],
      },
    },
    grammarItems: { type: "array", items: { type: "string" } },
    answerAssessment: {
      type: "object",
      properties: {
        vocabulary: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["correct", "partial", "incorrect"] },
            detail: { type: "string" },
          },
          required: ["status", "detail"],
          propertyOrdering: ["status", "detail"],
        },
        grammar: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["correct", "partial", "incorrect"] },
            detail: { type: "string" },
          },
          required: ["status", "detail"],
          propertyOrdering: ["status", "detail"],
        },
        naturalness: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["correct", "partial", "incorrect"] },
            detail: { type: "string" },
          },
          required: ["status", "detail"],
          propertyOrdering: ["status", "detail"],
        },
      },
      required: ["vocabulary", "grammar", "naturalness"],
      propertyOrdering: ["vocabulary", "grammar", "naturalness"],
    },
  },
  required: [
    "status",
    "feedback",
    "betterExpression",
    "explanationMarkdown",
    "words",
    "grammarItems",
    "answerAssessment",
  ],
  propertyOrdering: [
    "status",
    "feedback",
    "betterExpression",
    "explanationMarkdown",
    "words",
    "grammarItems",
    "answerAssessment",
  ],
};

interface GradeBody {
  targetLanguage?: TargetLanguage;
  level?: Level;
  japanesePrompt?: string;
  strictAnswer?: string;
  acceptedAnswers?: string[];
  requiredKeywords?: string[];
  grammarPoint?: string;
  userAnswer?: string;
}

function normalizeSpanishExplanationMarkdown(markdown: unknown): unknown {
  if (typeof markdown !== "string") return markdown;
  return markdown
    .replace(/\|\s*読み方(?:（[^|]*）)?\s*\|/g, "| 英語の意味 |")
    .replace(/\|\s*読み\s*\|/g, "| 英語の意味 |")
    .replace(/\|\s*\[読み\]\s*\|/g, "| [英語の意味] |");
}

function normalizeChineseExplanationMarkdown(markdown: unknown): unknown {
  if (typeof markdown !== "string") return markdown;
  let section = "";
  return markdown
    .split("\n")
    .map((line) => {
      if (line.startsWith("## ")) section = line;

      if (section === "## 模範解答の補足" && line.startsWith("**") && !line.startsWith("**自然な訳")) {
        return toTraditionalChinese(line);
      }

      if (section.includes("単語解説") && line.startsWith("|")) {
        const cells = line.split("|");
        const firstCell = cells[1]?.trim();
        if (!firstCell || firstCell === "---" || firstCell === "単語") return line;
        cells[1] = ` ${toTraditionalChinese(firstCell)} `;
        return cells.join("|");
      }

      if (section.includes("覚えておきたい構文")) {
        if (line.startsWith("**")) return toTraditionalChinese(line);
        if (line.startsWith("- ")) {
          const separator = line.indexOf("　");
          if (separator > 0) {
            return `${toTraditionalChinese(line.slice(0, separator))}${line.slice(separator)}`;
          }
        }
      }

      return line;
    })
    .join("\n");
}

function normalizeChineseGradeResult(parsed: Record<string, unknown>): Record<string, unknown> {
  return {
    ...parsed,
    betterExpression:
      typeof parsed.betterExpression === "string"
        ? toTraditionalChinese(parsed.betterExpression)
        : parsed.betterExpression,
    words: Array.isArray(parsed.words)
      ? parsed.words.map((word) => {
          if (!word || typeof word !== "object") return word;
          const item = word as Record<string, unknown>;
          return {
            ...item,
            surface:
              typeof item.surface === "string"
                ? toTraditionalChinese(item.surface)
                : item.surface,
          };
        })
      : parsed.words,
    explanationMarkdown: normalizeChineseExplanationMarkdown(parsed.explanationMarkdown),
  };
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

  const {
    targetLanguage,
    level,
    japanesePrompt,
    strictAnswer,
    acceptedAnswers,
    requiredKeywords,
    grammarPoint,
    userAnswer,
  } = body;
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
      : targetLanguage === "zh"
        ? "中国語の出力は、betterExpression・例文・単語表・words[].surface まで必ず繁体字に統一してください。簡体字（喜欢, 吗, 学, 说, 没 など）は使わず、喜歡, 嗎, 學, 說, 沒 のように書いてください。words[].reading と単語解説表の「読み方」列にはピンインを入れてください。学習者が簡体字で答えた場合も意味が合えば文字種だけで incorrect にしないでください。"
        : "words[].reading と単語解説表の「読み方」列には、読み方を入れてください（ヒンディー語はローマ字）。";

  const userMessage = `以下の練習問題を採点し、回答を踏まえた解説を作成してください。

言語: ${langLabel}
難易度: ${level ?? "A1"}
日本語文: ${japanesePrompt}
模範解答: ${strictAnswer}
${acceptedAnswers?.length ? `正解バリエーション: ${acceptedAnswers.join("、")}` : ""}
重要キーワード: ${requiredKeywords?.length ? requiredKeywords.join("、") : "（指定なし）"}
文法パターン: ${grammarPoint ?? "（指定なし）"}

学習者の回答: ${userAnswer}

単語欄の指示: ${readingInstruction}

単語記憶判定の指示:
- words は重要キーワードと模範解答の中心語彙を最優先し、最大8語まで入れる。代名詞・助詞・簡単な時の副詞だけで埋めない
- 学習者が中心語彙を省略した場合も、その中心語彙を words に入れて remembered=false / correctness=incorrect にする
- remembered は「その問題で必要な中心語彙を、正しい意味で知っていたか」で判定する
- 時制・活用・助詞・語順など文法だけが間違っていても、中心語彙を正しい意味で使えていれば単語は remembered=true / correctness=correct にする
- 意味が少しずれている近い単語・派生語は correctness=partial にする
- 単語を少し並べただけで、問題の中心語彙が不足している場合は answerAssessment.vocabulary.status を incorrect にする
- 例: 日本語文「明日、早く起きなければなりません。」に対して「मैं कल」だけなら、中心語彙「जल्दी」「उठना」と義務表現が欠けるため vocabulary は incorrect。words には जल्दी / उठना を incorrect として含める
- answerAssessment は vocabulary / grammar / naturalness を、それぞれ correct・partial・incorrect で評価し、detail に具体的理由を書く
- answerAssessment.detail は短すぎないように、それぞれ2〜3文で「何ができているか」「何を直すか」「回答中の具体的な語句」を含める
- 記号は correct=◯、partial=△、incorrect=× に固定する
- 「あなたの回答について」という見出しや内容は explanationMarkdown には書かない。回答評価は answerAssessment にだけ入れる

この回答を採点し、指定のJSON形式で返してください。単語解説は最大8語に絞り、回答評価は answerAssessment の単語・文法・自然さに分けて具体的に説明すること。`;

  try {
    const text = await generateGeminiText({
      maxOutputTokens: 3072,
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
    if (targetLanguage === "zh") {
      parsed = normalizeChineseGradeResult(parsed);
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
