import { NextRequest, NextResponse } from "next/server";
import type { AudioPurpose } from "@/lib/ai/types";
import {
  getOrCreateSpeech,
  hasTtsCredentials,
  readCachedSpeech,
  ttsCredentialsErrorMessage,
} from "@/lib/ai/cache/audioCache";

export const runtime = "nodejs";

const MAX_TTS_TEXT_LENGTH = 500;

interface SpeakBody {
  text?: string;
  lang?: string;
  purpose?: AudioPurpose;
  voiceId?: string;
  rate?: string;
  format?: "audio" | "json";
}

function speakError(error: unknown): NextResponse {
  console.error("[/api/speak]", error);
  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("quota")) {
    return NextResponse.json(
      { error: "自然音声の生成上限に達しています。時間を置いて再試行してください。" },
      { status: 429 },
    );
  }
  return NextResponse.json({ error: "自然音声の生成に失敗しました。" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  if (!hasTtsCredentials()) {
    return NextResponse.json({ error: ttsCredentialsErrorMessage() }, { status: 500 });
  }

  let body: SpeakBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました。" }, { status: 400 });
  }

  const text = body.text?.trim();
  const lang = body.lang?.trim() || "hi-IN";
  const purpose = body.purpose ?? "sentence";
  const format = body.format ?? "audio";

  if (!text) {
    return NextResponse.json({ error: "text がありません。" }, { status: 400 });
  }
  if (text.length > MAX_TTS_TEXT_LENGTH) {
    return NextResponse.json({ error: "読み上げる文章が長すぎます。" }, { status: 400 });
  }

  try {
    const result = await getOrCreateSpeech({
      text,
      lang,
      purpose,
      voiceId: body.voiceId,
      rate: body.rate,
    });

    if (format === "json") {
      return NextResponse.json({
        success: true,
        provider: result.provider,
        cached: result.cached,
        audioUrl: result.audioUrl,
        cacheKey: result.cacheKey,
        voiceId: result.voiceId,
        rate: result.rate,
        createdAt: result.createdAt,
      });
    }

    const audioBuffer = await readCachedSpeech(result);
    if (!audioBuffer) {
      return NextResponse.json({ error: "音声キャッシュを読み込めませんでした。" }, { status: 500 });
    }

    const responseBody = new ArrayBuffer(audioBuffer.byteLength);
    new Uint8Array(responseBody).set(audioBuffer);

    return new NextResponse(responseBody, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": result.contentType,
        "X-Audio-Cache": result.cached ? "hit" : "miss",
      },
    });
  } catch (error) {
    return speakError(error);
  }
}
