import { NextRequest, NextResponse } from "next/server";
import { parseAIJSON } from "@/lib/aiJson";
import { generateGeminiText, hasGeminiApiKey } from "@/lib/gemini";
import {
  LANGUAGE_GENERATION_LABELS,
  isTargetLanguage,
  targetLanguageListLabel,
} from "@/lib/languages";
import { toTraditionalChinese } from "@/lib/textNormalize";
import type { TargetLanguage, Level } from "@/types/question";

// 解説なし・問題データのみを生成する（高速）
// 採点と解説は /api/grade が回答を踏まえて生成する
const SYSTEM_PROMPT = `あなたは言語学習アプリ用の問題作成専門家です。
日本語の短文を見て指定された目標言語で答える練習問題を1問作成してください。

必ず以下のJSON形式のみで返答してください。コードフェンスや説明文は不要です。

{
  "japanesePrompt": "指定CEFRレベルに合った自然な日本語文（みんなの日本語スタイル。体言止め可）",
  "strictAnswer": "目標言語での主要な正解文字列",
  "acceptedAnswers": ["正解として認めるすべての表現バリエーション（表記差、代名詞省略、複数形、語尾変化なども含む）"],
  "requiredKeywords": ["正解に必ず含まれるべき重要単語"],
  "grammarPoint": "文法パターン表記（例: [人] + 喜歡 + 名詞）",
  "commonMistakes": [
    {
      "answer": "よくある誤答の文字列",
      "result": "close または incorrect",
      "feedback": "なぜ間違いかの日本語解説"
    }
  ]
}`;

const LANGUAGE_GRAMMAR_OPTIONS: Record<TargetLanguage, string[]> = {
  zh: [
    "我 + 喜歡 + 名詞",
    "你 + 動詞 + 嗎",
    "我 + 想 + 動詞",
    "我 + 有 + 名詞",
    "我 + 去 + 場所",
    "這是 / 那是 + 名詞",
    "我 + 在 + 場所",
    "我 + 要 + 動詞",
  ],
  hi: [
    "[人] + [好きなもの] + पसंद + है",
    "[人] + [場所] + जाता/जाती + है",
    "[人] + [もの] + चाहिए",
    "क्या + [人] + [動詞] + है（疑問文）",
    "[人] + [もの] + खाता/खाती + है",
    "[人] + [もの] + पीता/पीती + है",
    "[人] + को + [もの] + मिलता/मिलती + है",
    "[人] + [動詞] + सकता/सकती + है（できる）",
  ],
  es: [
    "主語 + ser + 名詞/形容詞",
    "主語 + estar + en + 場所",
    "tener + 名詞 / tener + 年齢",
    "no + 動詞",
    "ir + a + 場所 / 不定詞",
    "me gusta + 名詞単数 / 不定詞",
    "現在形 -ar / -er / -ir 動詞",
    "疑問詞 qué / dónde / por qué",
  ],
};

function asTraditionalChineseQuestion(parsed: Record<string, unknown>): Record<string, unknown> {
  return {
    ...parsed,
    strictAnswer:
      typeof parsed.strictAnswer === "string"
        ? toTraditionalChinese(parsed.strictAnswer)
        : parsed.strictAnswer,
    acceptedAnswers: Array.isArray(parsed.acceptedAnswers)
      ? parsed.acceptedAnswers.map((answer) =>
          typeof answer === "string" ? toTraditionalChinese(answer) : answer,
        )
      : parsed.acceptedAnswers,
    requiredKeywords: Array.isArray(parsed.requiredKeywords)
      ? parsed.requiredKeywords.map((keyword) =>
          typeof keyword === "string" ? toTraditionalChinese(keyword) : keyword,
        )
      : parsed.requiredKeywords,
    grammarPoint:
      typeof parsed.grammarPoint === "string"
        ? toTraditionalChinese(parsed.grammarPoint)
        : parsed.grammarPoint,
    commonMistakes: Array.isArray(parsed.commonMistakes)
      ? parsed.commonMistakes.map((mistake) => {
          if (!mistake || typeof mistake !== "object") return mistake;
          const item = mistake as Record<string, unknown>;
          return {
            ...item,
            answer:
              typeof item.answer === "string" ? toTraditionalChinese(item.answer) : item.answer,
          };
        })
      : parsed.commonMistakes,
  };
}

const QUESTION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    japanesePrompt: { type: "string" },
    strictAnswer: { type: "string" },
    acceptedAnswers: { type: "array", items: { type: "string" } },
    requiredKeywords: { type: "array", items: { type: "string" } },
    grammarPoint: { type: "string" },
    commonMistakes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          answer: { type: "string" },
          result: { type: "string", enum: ["close", "incorrect"] },
          feedback: { type: "string" },
        },
        required: ["answer", "result", "feedback"],
        propertyOrdering: ["answer", "result", "feedback"],
      },
    },
  },
  required: [
    "japanesePrompt",
    "strictAnswer",
    "acceptedAnswers",
    "requiredKeywords",
    "grammarPoint",
    "commonMistakes",
  ],
  propertyOrdering: [
    "japanesePrompt",
    "strictAnswer",
    "acceptedAnswers",
    "requiredKeywords",
    "grammarPoint",
    "commonMistakes",
  ],
};

export async function POST(request: NextRequest) {
  if (!hasGeminiApiKey()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が設定されていません。" },
      { status: 500 },
    );
  }

  let body: {
    targetLanguage?: TargetLanguage;
    level?: Level;
    grammar?: { name?: string; pattern?: string; summary?: string };
    reviewWord?: { surface?: string; meaning?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました。" }, { status: 400 });
  }

  const { targetLanguage, grammar, reviewWord } = body;
  const level: Level = body.level ?? "A1";
  if (!isTargetLanguage(targetLanguage)) {
    return NextResponse.json(
      { error: `targetLanguage に ${targetLanguageListLabel()} のいずれかを指定してください。` },
      { status: 400 },
    );
  }

  // カリキュラムから文法が指定されていればそれを使い、なければフォールバック候補から選ぶ
  const fallbackGrammarOptions = LANGUAGE_GRAMMAR_OPTIONS[targetLanguage];
  const grammarSpec =
    grammar?.name && grammar?.pattern
      ? `${grammar.name}（${grammar.pattern}）${grammar.summary ? " — " + grammar.summary : ""}`
      : fallbackGrammarOptions[Math.floor(Math.random() * fallbackGrammarOptions.length)];

  const levelGuide: Record<Level, string> = {
    A1: "最も基本的な語彙と文法。短い1文。日常のごく身近な話題。",
    A2: "基本的な語彙。時制や接続を少し含む短文。買い物・予定など身近な話題。",
    B1: "やや複雑な文。理由・条件・時間の接続詞を含む。意見や経験の描写。",
    B2: "複雑な構文。仮定・比較・抽象的な話題。自然で長めの1文。",
  };

  const reviewLine =
    reviewWord?.surface
      ? `\n- 可能であれば単語「${reviewWord.surface}」${reviewWord.meaning ? `（${reviewWord.meaning}）` : ""}を自然に含める（復習のため）`
      : "";
  const scriptLine =
    targetLanguage === "zh"
      ? "\n- 中国語の出力は必ず繁体字に統一する。簡体字（喜欢, 吗, 学, 说, 没 など）は使わず、喜歡, 嗎, 學, 說, 沒 のように書く"
      : "";

  const userMessage = `${LANGUAGE_GENERATION_LABELS[targetLanguage]} の練習問題を1問作成してください。

CEFRレベル: ${level}
レベルの目安: ${levelGuide[level]}
使う文法・構文: ${grammarSpec}

条件:
- 上記の文法・構文を必ず使った問題にする
- ${level} レベルに合った語彙で、実用的な日本語文にする
- ネイティブ話者との自然な会話で使いやすい文にする
- acceptedAnswers は代表的な正解バリエーションを最大4個に絞る
- commonMistakes は1〜2個${scriptLine}${reviewLine}`;

  try {
    const text = await generateGeminiText({
      maxOutputTokens: 1536,
      responseSchema: QUESTION_RESPONSE_SCHEMA,
      systemInstruction: SYSTEM_PROMPT,
      prompt: userMessage,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = parseAIJSON(text);
    } catch {
      console.error("[/api/generate] raw:", text.slice(0, 300));
      return NextResponse.json({ error: "JSONの解析に失敗しました。" }, { status: 500 });
    }

    const required = ["japanesePrompt", "strictAnswer", "acceptedAnswers", "requiredKeywords", "grammarPoint", "commonMistakes"];
    for (const field of required) {
      if (!(field in parsed)) {
        return NextResponse.json({ error: `フィールド "${field}" がありません。` }, { status: 500 });
      }
    }

    if (targetLanguage === "zh") {
      parsed = asTraditionalChineseQuestion(parsed);
    }

    return NextResponse.json({ question: parsed });
  } catch (error) {
    console.error("[/api/generate]", error);
    return NextResponse.json({ error: "問題の生成中にエラーが発生しました。" }, { status: 500 });
  }
}
