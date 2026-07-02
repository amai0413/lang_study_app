import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { TargetLanguage, Level } from "@/types/question";

// 解説なし・問題データのみを生成する（高速）
// 採点と解説は /api/grade が回答を踏まえて生成する
const SYSTEM_PROMPT = `あなたは言語学習アプリ用の問題作成専門家です。
日本語の短文を見て中国語またはヒンディー語で答える練習問題を1問作成してください。

必ず以下のJSON形式のみで返答してください。コードフェンスや説明文は不要です。

{
  "japanesePrompt": "指定CEFRレベルに合った自然な日本語文（みんなの日本語スタイル。体言止め可）",
  "strictAnswer": "目標言語での主要な正解文字列",
  "acceptedAnswers": ["正解として認めるすべての表現バリエーション（繁体・簡体差、複数形、語尾変化なども含む）"],
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

const LANGUAGE_CONFIG = {
  zh: {
    label: "中国語（繁体字優先、簡体字も可）",
    grammarOptions: [
      "我 + 喜歡/喜欢 + 名詞",
      "你 + 動詞 + 嗎/吗",
      "我 + 想 + 動詞",
      "我 + 有 + 名詞",
      "我 + 去 + 場所",
      "這是 / 那是 + 名詞",
      "我 + 在 + 場所",
      "我 + 要 + 動詞",
    ],
  },
  hi: {
    label: "ヒンディー語（デーヴァナーガリー文字）",
    grammarOptions: [
      "[人] + [好きなもの] + पसंद + है",
      "[人] + [場所] + जाता/जाती + है",
      "[人] + [もの] + चाहिए",
      "क्या + [人] + [動詞] + है（疑問文）",
      "[人] + [もの] + खाता/खाती + है",
      "[人] + [もの] + पीता/पीती + है",
      "[人] + को + [もの] + मिलता/मिलती + है",
      "[人] + [動詞] + सकता/सकती + है（できる）",
    ],
  },
} as const;

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

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY が設定されていません。" },
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
  if (!targetLanguage || !["zh", "hi"].includes(targetLanguage)) {
    return NextResponse.json({ error: "targetLanguage に 'zh' または 'hi' を指定してください。" }, { status: 400 });
  }

  const config = LANGUAGE_CONFIG[targetLanguage];
  // カリキュラムから文法が指定されていればそれを使い、なければフォールバック候補から選ぶ
  const grammarSpec =
    grammar?.name && grammar?.pattern
      ? `${grammar.name}（${grammar.pattern}）${grammar.summary ? " — " + grammar.summary : ""}`
      : config.grammarOptions[Math.floor(Math.random() * config.grammarOptions.length)];

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

  const userMessage = `${config.label} の練習問題を1問作成してください。

CEFRレベル: ${level}
レベルの目安: ${levelGuide[level]}
使う文法・構文: ${grammarSpec}

条件:
- 上記の文法・構文を必ず使った問題にする
- ${level} レベルに合った語彙で、実用的な日本語文にする
- acceptedAnswers は採点で○にすべき全バリエーションを入れる
- commonMistakes は1〜2個${reviewLine}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "問題の生成が拒否されました。" }, { status: 422 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "レスポンスが空でした。" }, { status: 500 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJSON(textBlock.text));
    } catch {
      console.error("[/api/generate] raw:", textBlock.text.slice(0, 300));
      return NextResponse.json({ error: "JSONの解析に失敗しました。" }, { status: 500 });
    }

    const required = ["japanesePrompt", "strictAnswer", "acceptedAnswers", "requiredKeywords", "grammarPoint", "commonMistakes"];
    for (const field of required) {
      if (!(field in parsed)) {
        return NextResponse.json({ error: `フィールド "${field}" がありません。` }, { status: 500 });
      }
    }

    return NextResponse.json({ question: parsed });
  } catch (error) {
    console.error("[/api/generate]", error);
    return NextResponse.json({ error: "問題の生成中にエラーが発生しました。" }, { status: 500 });
  }
}
