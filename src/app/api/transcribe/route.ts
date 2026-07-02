import { NextRequest, NextResponse } from "next/server";
import { generateGeminiContent, hasGeminiApiKey } from "@/lib/gemini";
import { LANGUAGE_LABELS, isTargetLanguage, targetLanguageListLabel } from "@/lib/languages";

export async function POST(request: NextRequest) {
  if (!hasGeminiApiKey()) {
    return NextResponse.json({ error: "GEMINI_API_KEY が設定されていません。" }, { status: 500 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "音声データの解析に失敗しました。" }, { status: 400 });
  }

  const audio = formData.get("audio");
  const targetLanguage = formData.get("targetLanguage");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "audio がありません。" }, { status: 400 });
  }
  if (!isTargetLanguage(targetLanguage)) {
    return NextResponse.json(
      { error: `targetLanguage に ${targetLanguageListLabel()} のいずれかを指定してください。` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mimeType = audio.type || "audio/webm";

  try {
    const text = await generateGeminiContent({
      systemInstruction:
        "あなたは語学学習アプリの音声認識エンジンです。音声を指定言語の文字に正確に書き起こします。説明や翻訳は不要です。",
      parts: [
        {
          text: `${LANGUAGE_LABELS[targetLanguage]}の学習者音声を、その言語の文字だけで書き起こしてください。句読点は自然に最小限で入れてください。`,
        },
        {
          inlineData: {
            mimeType,
            data: buffer.toString("base64"),
          },
        },
      ],
      maxOutputTokens: 256,
      responseMimeType: "text/plain",
      temperature: 0,
    });

    return NextResponse.json({ transcript: text.trim() });
  } catch (error) {
    console.error("[/api/transcribe]", error);
    return NextResponse.json({ error: "音声の文字起こしに失敗しました。" }, { status: 500 });
  }
}
