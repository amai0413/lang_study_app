import type { AudioProviderName, StoredAudioMetadata } from "@/lib/ai/types";
import { speechLanguageFor } from "@/lib/speech";
import { findWordRecord, updateWordAudio, type WordRecord } from "@/lib/wordStore";
import type { TargetLanguage } from "@/types/question";

const MAX_BATCH = 30;

interface BackfillTarget {
  lang: TargetLanguage;
  surface: string;
  existingAudioUrl?: string | null;
}

interface BackfillItemResult {
  text?: string;
  language?: TargetLanguage;
  status?: string;
  audioUrl?: string;
  provider?: AudioProviderName;
  voiceId?: string;
  rate?: string;
  cacheKey?: string;
  createdAt?: string;
  error?: string;
}

export interface BackfillResult {
  /** updateWordAudio 適用後の単語一覧（更新が無ければ null） */
  words: WordRecord[] | null;
  generated: number;
  skipped: number;
  failed: number;
  quotaExceeded: boolean;
  message: string;
}

/** 単語音声を一括生成し、結果を単語DBへ反映する。学習状況の手動ボタンと自動生成の両方が使う。 */
export async function backfillWordAudio(targets: BackfillTarget[]): Promise<BackfillResult> {
  const batch = targets.slice(0, MAX_BATCH);
  const response = await fetch("/api/audio/backfill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: batch.map((target) => ({
        type: "word",
        text: target.surface,
        lang: speechLanguageFor(target.lang),
        existingAudioUrl: target.existingAudioUrl ?? null,
      })),
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    generated?: number;
    skipped?: number;
    failed?: number;
    quotaExceeded?: boolean;
    error?: string;
    items?: BackfillItemResult[];
  };
  if (!response.ok) {
    throw new Error(data.error ?? "単語音声の一括生成に失敗しました。");
  }

  const updates: Parameters<typeof updateWordAudio>[0] = [];
  for (const item of data.items ?? []) {
    if (!item.text || !item.language) continue;
    if (!item.audioUrl || !item.cacheKey) {
      updates.push({
        lang: item.language,
        surface: item.text,
        audioStatus: "failed",
        audioError: item.error ?? "音声生成に失敗しました。",
      });
      continue;
    }
    const audio: StoredAudioMetadata = {
      audioUrl: item.audioUrl,
      provider: item.provider ?? "gemini",
      voiceId: item.voiceId,
      rate: item.rate,
      cacheKey: item.cacheKey,
      createdAt: item.createdAt ?? new Date().toISOString(),
    };
    updates.push({
      lang: item.language,
      surface: item.text,
      audio,
      audioStatus: "ready",
      audioError: undefined,
    });
  }

  const generated = data.generated ?? 0;
  const skipped = data.skipped ?? 0;
  const failed = data.failed ?? 0;
  const quotaExceeded = Boolean(data.quotaExceeded);

  return {
    words: updates.length > 0 ? updateWordAudio(updates) : null,
    generated,
    skipped,
    failed,
    quotaExceeded,
    message: quotaExceeded
      ? `生成 ${generated}件で音声生成の上限に達しました。時間を置いて再試行してください。`
      : `生成 ${generated}件・既存 ${skipped}件・失敗 ${failed}件`,
  };
}

/**
 * 採点・例文登録の直後に呼ぶ自動生成。渡された単語のうち音声が無いものだけを
 * 裏で生成する（fire-and-forget）。失敗してもUIは止めない。
 */
export function backfillMissingWordAudio(lang: TargetLanguage, surfaces: string[]): void {
  const targets: BackfillTarget[] = [];
  const seen = new Set<string>();
  for (const surface of surfaces) {
    const trimmed = surface.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    const record = findWordRecord(lang, trimmed);
    if (!record || record.audio?.audioUrl) continue;
    targets.push({ lang, surface: record.surface });
  }
  if (targets.length === 0) return;
  void backfillWordAudio(targets).catch(() => {
    // Opportunistic generation: quota errors etc. surface via audioStatus="failed" chips.
  });
}
