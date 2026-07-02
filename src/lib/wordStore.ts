import type { TargetLanguage } from "@/types/question";
import type { WordEntry } from "./grade";
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

export function loadWords(): WordRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = normalizeStoredWords(parsed as WordRecord[]);
    if (normalized.changed) saveWords(normalized.words);
    return normalized.words;
  } catch {
    return [];
  }
}

function saveWords(words: WordRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
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
