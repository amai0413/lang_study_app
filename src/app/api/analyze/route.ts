import { NextRequest, NextResponse } from "next/server";
import { parseAIJSON } from "@/lib/aiJson";
import { generateGeminiText, hasGeminiApiKey } from "@/lib/gemini";
import { LANGUAGE_LABELS, isTargetLanguage, targetLanguageListLabel } from "@/lib/languages";
import { toTraditionalChinese } from "@/lib/textNormalize";
import type { TargetLanguage } from "@/types/question";

// 「例文登録」用のAPI。
// チャット/SNSで受け取った目標言語の短文を貼り付けると、
// 単語解説・そのまま使える型・自然な訳を返す。音声は既存の /api/speak を使う。
const MAX_PHRASE_LENGTH = 400;

const SYSTEM_PROMPT = `あなたは言語学習アプリの「例文解析」担当です。
学習者がチャットやSNSで受け取った短い文（目標言語）を貼り付けます。
その文を、初学者が「読めて」「自分でも応用でき」「声に出せる」ように解析してください。

必ず以下のJSON形式のみで返答してください。コードフェンスや前置きは不要です。

{
  "normalizedText": "元の文を自然な表記に整えたもの（明らかな打ち間違い・崩し表記だけ直す。意味やトーンは変えない）",
  "reading": "元の文の読み（中国語は拼音、ヒンディー語はローマ字。スペイン語のときは空文字）",
  "translation": "自然な日本語訳",
  "english": "自然で流暢な英訳（スペイン語のときのみ入れる。中国語・ヒンディー語のときは空文字）",
  "literal": "語順に沿った直訳（可能なら。難しければ空文字）",
  "register": "話し方のトーンを日本語で一言（例: 親しい友人へのカジュアル、丁寧、スラング多めなど）",
  "words": [
    { "surface": "文中に現れた形の単語・熟語", "reading": "読み方", "meaning": "日本語の意味", "pos": "品詞", "note": "原形・活用・ニュアンスなどの短い補足" }
  ],
  "patterns": [
    {
      "template": "空欄つきで再利用できる型",
      "templateReading": "型の読み（中国語は拼音、ヒンディー語はローマ字。スペイン語のときは空文字）",
      "meaning": "その型で言えること",
      "swaps": [ { "term": "入れ替え語", "meaning": "意味", "example": "型に入れた自然な例文", "exampleReading": "その例文の読み（中国語は拼音、ヒンディー語はローマ字。スペイン語のときは空文字）", "exampleEnglish": "その例文の自然な英訳（スペイン語のときのみ。それ以外は空文字）" } ],
      "examples": [ { "text": "学習者がすぐ使える応用文", "reading": "その応用文の読み（中国語は拼音、ヒンディー語はローマ字。スペイン語のときは空文字）", "translation": "自然な日本語訳", "english": "その応用文の自然な英訳（スペイン語のときのみ。それ以外は空文字）" } ],
      "note": "間違えやすい点・自然に使うコツ"
    }
  ]
}`;

const ANALYZE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    normalizedText: { type: "string" },
    reading: { type: "string" },
    translation: { type: "string" },
    english: { type: "string" },
    literal: { type: "string" },
    register: { type: "string" },
    words: {
      type: "array",
      items: {
        type: "object",
        properties: {
          surface: { type: "string" },
          reading: { type: "string" },
          meaning: { type: "string" },
          pos: { type: "string" },
          note: { type: "string" },
        },
        required: ["surface", "reading", "meaning", "pos", "note"],
        propertyOrdering: ["surface", "reading", "meaning", "pos", "note"],
      },
    },
    patterns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          template: { type: "string" },
          templateReading: { type: "string" },
          meaning: { type: "string" },
          swaps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                term: { type: "string" },
                meaning: { type: "string" },
                example: { type: "string" },
                exampleReading: { type: "string" },
                exampleEnglish: { type: "string" },
              },
              required: ["term", "meaning", "example", "exampleReading", "exampleEnglish"],
              propertyOrdering: ["term", "meaning", "example", "exampleReading", "exampleEnglish"],
            },
          },
          examples: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                reading: { type: "string" },
                translation: { type: "string" },
                english: { type: "string" },
              },
              required: ["text", "reading", "translation", "english"],
              propertyOrdering: ["text", "reading", "translation", "english"],
            },
          },
          note: { type: "string" },
        },
        required: ["template", "templateReading", "meaning", "swaps", "examples", "note"],
        propertyOrdering: ["template", "templateReading", "meaning", "swaps", "examples", "note"],
      },
    },
  },
  required: ["normalizedText", "reading", "translation", "english", "literal", "register", "words", "patterns"],
  propertyOrdering: ["normalizedText", "reading", "translation", "english", "literal", "register", "words", "patterns"],
};

interface AnalyzeBody {
  targetLanguage?: TargetLanguage;
  text?: string;
}

function mapString(value: unknown, fn: (text: string) => string): unknown {
  return typeof value === "string" ? fn(value) : value;
}

// 中国語は繁体字に統一する（モデルが簡体字を返すことがあるため保険をかける）。
function asTraditionalChinesePhrase(parsed: Record<string, unknown>): Record<string, unknown> {
  const traditionalWords = Array.isArray(parsed.words)
    ? parsed.words.map((word) => {
        if (!word || typeof word !== "object") return word;
        const item = word as Record<string, unknown>;
        return { ...item, surface: mapString(item.surface, toTraditionalChinese) };
      })
    : parsed.words;

  const traditionalPatterns = Array.isArray(parsed.patterns)
    ? parsed.patterns.map((pattern) => {
        if (!pattern || typeof pattern !== "object") return pattern;
        const item = pattern as Record<string, unknown>;
        return {
          ...item,
          template: mapString(item.template, toTraditionalChinese),
          swaps: Array.isArray(item.swaps)
            ? item.swaps.map((swap) => {
                if (!swap || typeof swap !== "object") return swap;
                const s = swap as Record<string, unknown>;
                return {
                  ...s,
                  term: mapString(s.term, toTraditionalChinese),
                  example: mapString(s.example, toTraditionalChinese),
                };
              })
            : item.swaps,
          examples: Array.isArray(item.examples)
            ? item.examples.map((example) => {
                if (!example || typeof example !== "object") return example;
                const e = example as Record<string, unknown>;
                return { ...e, text: mapString(e.text, toTraditionalChinese) };
              })
            : item.examples,
        };
      })
    : parsed.patterns;

  return {
    ...parsed,
    normalizedText: mapString(parsed.normalizedText, toTraditionalChinese),
    literal: mapString(parsed.literal, toTraditionalChinese),
    words: traditionalWords,
    patterns: traditionalPatterns,
  };
}

export async function POST(request: NextRequest) {
  if (!hasGeminiApiKey()) {
    return NextResponse.json({ error: "GEMINI_API_KEY が設定されていません。" }, { status: 500 });
  }

  let body: AnalyzeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました。" }, { status: 400 });
  }

  const { targetLanguage } = body;
  const text = body.text?.trim();
  if (!isTargetLanguage(targetLanguage)) {
    return NextResponse.json(
      { error: `targetLanguage に ${targetLanguageListLabel()} のいずれかを指定してください。` },
      { status: 400 },
    );
  }
  if (!text) {
    return NextResponse.json({ error: "解析する文を入力してください。" }, { status: 400 });
  }
  if (text.length > MAX_PHRASE_LENGTH) {
    return NextResponse.json({ error: "文が長すぎます。短い文を登録してください。" }, { status: 400 });
  }

  const readingInstruction =
    targetLanguage === "es"
      ? "words[].reading には発音ではなく英語での意味を入れてください（例: casa -> house, quedamos -> we agree to meet）。"
      : targetLanguage === "zh"
        ? "出力は繁体字に統一し、簡体字（喜欢, 吗, 学, 说, 没 など）は使わないでください。words[].reading にはピンインを入れてください。"
        : "words[].reading には読み方（ヒンディー語はローマ字）を入れてください。";

  const englishInstruction =
    targetLanguage === "es"
      ? "スペイン語なので、english（元の文の自然な英訳）・examples[].english・swaps[].exampleEnglish に、直訳ではなくネイティブが使う自然で流暢な英訳を必ず入れてください。"
      : "スペイン語ではないので、english・examples[].english・swaps[].exampleEnglish はすべて空文字にしてください。";

  const patternReadingInstruction =
    targetLanguage === "es"
      ? "スペイン語なので、reading・templateReading・examples[].reading・swaps[].exampleReading はすべて空文字にしてください。"
      : targetLanguage === "zh"
        ? "中国語なので、reading・templateReading・examples[].reading・swaps[].exampleReading に、その繁体字の文の拼音（声調記号つき）を必ず入れてください。型（templateReading）の空欄部分は [　] のまま残してください。"
        : "ヒンディー語なので、reading・templateReading・examples[].reading・swaps[].exampleReading に、その文のローマ字読みを必ず入れてください。";

  const userMessage = `${LANGUAGE_LABELS[targetLanguage]} の次の文を解析してください。チャットやSNSで実際に受け取った砕けた表現・スラング・省略が含まれることがあります。

登録する文:
${text}

条件:
- words には文中の意味のある語・熟語を最大10語入れる。冠詞・前置詞だけで埋めない。口語・スラング・略語は必ず入れて意味を説明する
- surface は原形ではなく文中に現れた形にし、note に原形や活用・ニュアンスを書く
- patterns は、この文から本当に応用できる型を1〜2個。type は空欄（[　]など）を含む再利用可能なテンプレートにする
- swaps は各 pattern に2〜4個、実用的な入れ替え語と自然な例文を入れる
- examples は各 pattern に1〜2個、学習者がすぐ使える応用文と日本語訳を入れる
- translation は自然な日本語、literal は語順に沿った直訳にする
- ${readingInstruction}
- ${englishInstruction}
- ${patternReadingInstruction}

指定のJSON形式のみで返してください。`;

  try {
    const raw = await generateGeminiText({
      maxOutputTokens: 2560,
      responseSchema: ANALYZE_RESPONSE_SCHEMA,
      systemInstruction: SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.2,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = parseAIJSON(raw);
    } catch {
      console.error("[/api/analyze] raw:", raw.slice(0, 400));
      return NextResponse.json({ error: "解析結果の読み取りに失敗しました。" }, { status: 500 });
    }

    if (targetLanguage === "zh") {
      parsed = asTraditionalChinesePhrase(parsed);
    }

    if (!parsed.normalizedText || !Array.isArray(parsed.words)) {
      return NextResponse.json({ error: "解析結果が不完全です。" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[/api/analyze]", error);
    return NextResponse.json({ error: "例文の解析中にエラーが発生しました。" }, { status: 500 });
  }
}
