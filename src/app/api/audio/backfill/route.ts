import { NextRequest, NextResponse } from "next/server";
import {
  activeTtsProvider,
  getOrCreateSpeech,
  hasTtsCredentials,
  ttsCredentialsErrorMessage,
} from "@/lib/ai/cache/audioCache";
import { speechLangForAudio, targetLanguageFromSpeechLang } from "@/lib/ai/types";

export const runtime = "nodejs";

const MAX_BACKFILL_ITEMS = 30;

interface BackfillItem {
  type?: "word" | "sentence";
  text?: string;
  lang?: string;
  language?: string;
  existingAudioUrl?: string | null;
}

interface BackfillBody {
  language?: string;
  voiceId?: string;
  rate?: string;
  items?: BackfillItem[];
}

export async function POST(request: NextRequest) {
  if (!hasTtsCredentials()) {
    return NextResponse.json({ error: ttsCredentialsErrorMessage() }, { status: 500 });
  }

  let body: BackfillBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました。" }, { status: 400 });
  }

  const requestedItems = Array.isArray(body.items) ? body.items : [];
  const items = requestedItems.slice(0, MAX_BACKFILL_ITEMS);
  if (items.length === 0) {
    return NextResponse.json({ error: "items がありません。" }, { status: 400 });
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  // クォータ切れは残りの全件も確実に失敗するので、最初の1件で打ち切る。
  // 30件分ハンマリングして「生成中」のまま何分も固まるのを防ぐ。
  let quotaExceeded = false;

  const results = [];

  for (const item of items) {
    if (quotaExceeded) break;
    const text = item.text?.trim();
    const lang = speechLangForAudio(item.lang ?? item.language ?? body.language ?? "");
    const targetLanguage = targetLanguageFromSpeechLang(lang);

    if (!text || !targetLanguage) {
      failed += 1;
      results.push({
        text: text ?? "",
        language: item.lang ?? item.language ?? body.language ?? "",
        status: "failed",
        error: "text または language が不正です。",
      });
      continue;
    }

    if (item.existingAudioUrl) {
      skipped += 1;
      results.push({
        text,
        language: targetLanguage,
        audioUrl: item.existingAudioUrl,
        status: "already_exists",
      });
      continue;
    }

    try {
      const audio = await getOrCreateSpeech({
        text,
        lang,
        purpose: item.type === "sentence" ? "sentence" : "word",
        voiceId: body.voiceId,
        rate: body.rate,
      });

      if (audio.cached) {
        skipped += 1;
      } else {
        generated += 1;
      }

      results.push({
        text,
        language: targetLanguage,
        cacheKey: audio.cacheKey,
        audioUrl: audio.audioUrl,
        provider: audio.provider,
        voiceId: audio.voiceId,
        rate: audio.rate,
        createdAt: audio.createdAt,
        status: audio.cached ? "already_exists" : "generated",
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "";
      const isQuota = message.toLowerCase().includes("quota");
      if (isQuota) quotaExceeded = true;
      results.push({
        text,
        language: targetLanguage,
        status: "failed",
        error: isQuota ? "音声生成の上限に達しています。" : message || "音声生成に失敗しました。",
      });
    }
  }

  return NextResponse.json({
    success: failed === 0,
    provider: activeTtsProvider(),
    requested: requestedItems.length,
    processed: results.length,
    generated,
    skipped,
    failed,
    quotaExceeded,
    items: results,
  });
}
