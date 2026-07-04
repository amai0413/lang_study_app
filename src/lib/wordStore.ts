import type { TargetLanguage } from "@/types/question";
import type { AudioStatus, StoredAudioMetadata } from "@/lib/ai/types";
import type { WordEntry } from "./grade";
import { readLocalStorageJSON, writeLocalStorageJSON } from "./localStore";
import { normalizeWordSurface, wordRecordKey } from "./textNormalize";

export interface WordRecord {
  key: string; // `${lang}:${surface}`
  lang: TargetLanguage;
  surface: string;
  reading: string;
  meaning: string;
  pos: string;
  seenCount: number;
  correctCount: number;
  remembered: boolean; // 直近の結果で覚えていたか
  lastSeen: string; // ISO
  audio?: StoredAudioMetadata;
  audioStatus?: AudioStatus;
  audioError?: string;
}

const STORAGE_KEY = "voice-grammar-trainer:words";

function mergeWordRecord(existing: WordRecord, next: WordRecord): WordRecord {
  const nextIsNewer = (next.lastSeen || "").localeCompare(existing.lastSeen || "") >= 0;
  const latest = nextIsNewer ? next : existing;
  return {
    ...existing,
    surface: latest.surface,
    reading: latest.reading || existing.reading,
    meaning: latest.meaning || existing.meaning,
    pos: latest.pos || existing.pos,
    seenCount: existing.seenCount + next.seenCount,
    correctCount: existing.correctCount + next.correctCount,
    remembered: latest.remembered,
    lastSeen: latest.lastSeen || existing.lastSeen,
    audio: latest.audio ?? existing.audio,
    audioStatus: latest.audioStatus ?? existing.audioStatus ?? (latest.audio ?? existing.audio ? "ready" : "none"),
    audioError: latest.audioError ?? existing.audioError,
  };
}

function normalizeStoredWords(words: WordRecord[]): { words: WordRecord[]; changed: boolean } {
  const byKey = new Map<string, WordRecord>();
  let changed = false;

  for (const word of words) {
    if (!word?.lang || !word.surface) {
      changed = true;
      continue;
    }

    const normalizedSurface = normalizeWordSurface(word.lang, word.surface);
    const key = wordRecordKey(word.lang, normalizedSurface);
    const normalized: WordRecord = {
      ...word,
      key,
      surface: normalizedSurface,
      reading: word.reading ?? "",
      meaning: word.meaning ?? "",
      pos: word.pos ?? "",
      seenCount: word.seenCount ?? 0,
      correctCount: word.correctCount ?? 0,
      remembered: Boolean(word.remembered),
      lastSeen: word.lastSeen ?? "",
      audio: word.audio,
      audioStatus: word.audioStatus ?? (word.audio ? "ready" : "none"),
      audioError: word.audioError,
    };
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, mergeWordRecord(existing, normalized));
      changed = true;
    } else {
      byKey.set(key, normalized);
    }

    if (word.key !== key || word.surface !== normalizedSurface) {
      changed = true;
    }
  }

  return { words: [...byKey.values()], changed };
}

// 単語DBは採点・統計・カード表示など至る所から読まれるので、
// 呼び出しのたびに全件を JSON.parse + 正規化するのは避けてメモリに持つ。
// 書き込みは必ず saveWords を通るため、そこでキャッシュを更新すれば一貫する。
let wordsCache: WordRecord[] | null = null;

export function loadWords(): WordRecord[] {
  if (wordsCache) return wordsCache;
  const raw = readLocalStorageJSON<WordRecord[]>(STORAGE_KEY, [], Array.isArray);
  if (raw.length === 0) return raw;
  const normalized = normalizeStoredWords(raw);
  if (normalized.changed) saveWords(normalized.words);
  else wordsCache = normalized.words;
  return normalized.words;
}

export function saveWords(words: WordRecord[]) {
  wordsCache = words;
  writeLocalStorageJSON(STORAGE_KEY, words);
}

/** 表示用: 1単語の学習記録を引く（無ければ undefined）。 */
export function findWordRecord(lang: TargetLanguage, surface: string): WordRecord | undefined {
  const key = wordRecordKey(lang, surface);
  return loadWords().find((word) => word.key === key);
}

export function updateWordAudio(
  updates: Array<{
    lang: TargetLanguage;
    surface: string;
    audio?: StoredAudioMetadata;
    audioStatus?: AudioStatus;
    audioError?: string;
  }>,
): WordRecord[] {
  const all = loadWords();
  const byKey = new Map(all.map((word) => [word.key, word]));

  for (const update of updates) {
    const surface = normalizeWordSurface(update.lang, update.surface);
    const key = wordRecordKey(update.lang, surface);
    const existing = byKey.get(key);
    if (!existing) continue;
    byKey.set(key, {
      ...existing,
      audio: update.audio ?? existing.audio,
      audioStatus: update.audioStatus ?? (update.audio ? "ready" : existing.audioStatus ?? "none"),
      audioError: update.audioError,
    });
  }

  const next = [...byKey.values()];
  saveWords(next);
  return next;
}

/**
 * 採点結果から単語DBを更新する。
 * 単語ごとの remembered/correctness を優先し、なければ fallbackRemembered を使う。
 */
export function recordWords(
  lang: TargetLanguage,
  words: WordEntry[],
  fallbackRemembered: boolean,
): void {
  if (!words || words.length === 0) return;
  const all = loadWords();
  const byKey = new Map(all.map((w) => [w.key, w]));
  const now = new Date().toISOString();

  for (const w of words) {
    const surface = normalizeWordSurface(lang, w.surface ?? "");
    if (!surface) continue;
    const key = wordRecordKey(lang, surface);
    const remembered =
      typeof w.remembered === "boolean"
        ? w.remembered
        : w.correctness
          ? w.correctness === "correct"
          : fallbackRemembered;
    const existing = byKey.get(key);
    if (existing) {
      existing.seenCount += 1;
      if (remembered) existing.correctCount += 1;
      existing.remembered = remembered;
      existing.lastSeen = now;
      // 意味・読みは最新のもので補完
      existing.reading = w.reading || existing.reading;
      existing.meaning = w.meaning || existing.meaning;
      existing.pos = w.pos || existing.pos;
    } else {
      byKey.set(key, {
        key,
        lang,
        surface,
        reading: w.reading ?? "",
        meaning: w.meaning ?? "",
        pos: w.pos ?? "",
        seenCount: 1,
        correctCount: remembered ? 1 : 0,
        remembered,
        lastSeen: now,
        audioStatus: "none",
      });
    }
  }
  saveWords([...byKey.values()]);
}

export function recordWordPractice(
  lang: TargetLanguage,
  word: Pick<WordEntry, "surface" | "reading" | "meaning" | "pos">,
  remembered: boolean,
): void {
  recordWords(
    lang,
    [
      {
        ...word,
        remembered,
        correctness: remembered ? "correct" : "incorrect",
        note: remembered ? "単語練習で正解" : "単語練習で復習",
      },
    ],
    remembered,
  );
}

/** 覚えていない（直近で間違えた）単語を古い順に返す */
export function getForgottenWords(lang: TargetLanguage): WordRecord[] {
  return loadWords()
    .filter((w) => w.lang === lang && !w.remembered)
    .sort((a, b) => a.lastSeen.localeCompare(b.lastSeen));
}

export function getWordStats(lang: TargetLanguage): { learned: number; review: number } {
  const words = loadWords().filter((w) => w.lang === lang);
  return {
    learned: words.length,
    review: words.filter((w) => !w.remembered).length,
  };
}

/** 例文登録での単語の表示状態: 記憶済み / 復習 / 初見（確認） */
export type PhraseWordStatus = "remembered" | "review" | "new";

/**
 * 例文に含まれる単語をDBと照合しつつ登録する。
 * - 既存語: 記憶状態は変えず、出現回数と最終出現・意味/読みの補完だけ更新する
 * - 初見語: remembered=false（確認待ち）で新規登録し、復習の輪に入れる
 * 表示用に、保存「前」の状態から判定したステータスを normalizedSurface -> status で返す。
 */
export function registerPhraseWords(
  lang: TargetLanguage,
  words: Array<Pick<WordEntry, "surface" | "reading" | "meaning" | "pos">>,
): Record<string, PhraseWordStatus> {
  const all = loadWords();
  const byKey = new Map(all.map((w) => [w.key, w]));
  const now = new Date().toISOString();
  const statuses: Record<string, PhraseWordStatus> = {};

  for (const w of words) {
    const surface = normalizeWordSurface(lang, w.surface ?? "");
    if (!surface) continue;
    const key = wordRecordKey(lang, surface);
    const existing = byKey.get(key);

    // 保存前の状態で判定する（初見なら「確認」を表示できる）
    if (!(surface in statuses)) {
      statuses[surface] = existing ? (existing.remembered ? "remembered" : "review") : "new";
    }

    if (existing) {
      existing.seenCount += 1;
      existing.lastSeen = now;
      existing.reading = w.reading || existing.reading;
      existing.meaning = w.meaning || existing.meaning;
      existing.pos = w.pos || existing.pos;
      // 記憶状態（remembered）は練習・採点の結果を尊重して維持する
    } else {
      byKey.set(key, {
        key,
        lang,
        surface,
        reading: w.reading ?? "",
        meaning: w.meaning ?? "",
        pos: w.pos ?? "",
        seenCount: 1,
        correctCount: 0,
        remembered: false,
        lastSeen: now,
        audioStatus: "none",
      });
    }
  }

  saveWords([...byKey.values()]);
  return statuses;
}
