import type { TargetLanguage } from "@/types/question";
import { readLocalStorageJSON, writeLocalStorageJSON } from "./localStore";

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
  return readLocalStorageJSON<HistoryEntry[]>(STORAGE_KEY, [], Array.isArray);
}

export function saveHistory(history: HistoryEntry[]): void {
  writeLocalStorageJSON(STORAGE_KEY, history);
}

export function appendHistory(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const updated = [...history, entry];
  saveHistory(updated);
  return updated;
}
