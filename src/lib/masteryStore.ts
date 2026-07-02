import type { GrammarItem } from "@/data/curriculum";

export interface MasteryRecord {
  grammarItemId: string;
  attempts: number;
  correct: number;
  lastSeen: string; // ISO
}

const STORAGE_KEY = "voice-grammar-trainer:mastery";

export function loadMastery(): Record<string, MasteryRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, MasteryRecord>) : {};
  } catch {
    return {};
  }
}

function saveMastery(data: Record<string, MasteryRecord>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function recordMasteryAttempt(grammarItemId: string, wasCorrect: boolean): void {
  if (!grammarItemId) return;
  const data = loadMastery();
  const rec = data[grammarItemId] ?? { grammarItemId, attempts: 0, correct: 0, lastSeen: "" };
  rec.attempts += 1;
  if (wasCorrect) rec.correct += 1;
  rec.lastSeen = new Date().toISOString();
  data[grammarItemId] = rec;
  saveMastery(data);
}

/** 正答率（未挑戦は 1 = まだ弱点ではない扱い） */
export function masteryRate(grammarItemId: string): number {
  const rec = loadMastery()[grammarItemId];
  if (!rec || rec.attempts === 0) return 1;
  return rec.correct / rec.attempts;
}

/** 弱点の文法項目（1回以上挑戦して正答率が閾値未満） */
export function getWeakItems(items: GrammarItem[], threshold = 0.6): GrammarItem[] {
  const data = loadMastery();
  return items.filter((it) => {
    const rec = data[it.id];
    return rec && rec.attempts >= 1 && rec.correct / rec.attempts < threshold;
  });
}
