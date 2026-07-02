import type { TargetLanguage } from "@/types/question";
import type { WordEntry } from "./grade";

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

export function loadWords(): WordRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WordRecord[]) : [];
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
 * wasCorrect=true なら「覚えていた」として correctCount を加算。
 */
export function recordWords(
  lang: TargetLanguage,
  words: WordEntry[],
  wasCorrect: boolean,
): void {
  if (!words || words.length === 0) return;
  const all = loadWords();
  const byKey = new Map(all.map((w) => [w.key, w]));
  const now = new Date().toISOString();

  for (const w of words) {
    const surface = w.surface?.trim();
    if (!surface) continue;
    const key = `${lang}:${surface}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.seenCount += 1;
      if (wasCorrect) existing.correctCount += 1;
      existing.remembered = wasCorrect;
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
        correctCount: wasCorrect ? 1 : 0,
        remembered: wasCorrect,
        lastSeen: now,
      });
    }
  }
  saveWords([...byKey.values()]);
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
