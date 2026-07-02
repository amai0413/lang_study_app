import type { TargetLanguage } from "@/types/question";

export type HistoryStatus = "correct" | "close" | "incorrect";

export interface HistoryEntry {
  questionId: string;
  targetLanguage: TargetLanguage;
  userInput: string;
  result: HistoryStatus;
  timestamp: string;
}

const STORAGE_KEY = "voice-grammar-trainer:history";

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function appendHistory(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const updated = [...history, entry];
  saveHistory(updated);
  return updated;
}
