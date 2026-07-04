import type { TargetLanguage } from "@/types/question";

export interface PhraseWord {
  surface: string;
  reading: string;
  meaning: string;
  pos: string;
  note: string;
}

export interface PhraseSwap {
  term: string;
  meaning: string;
  example: string;
  /** 中国語=拼音 / ヒンディー語=ローマ字（スペイン語のときは空） */
  exampleReading: string;
  /** スペイン語のときのみ: 例文の自然な英訳 */
  exampleEnglish: string;
}

export interface PhraseExample {
  text: string;
  /** 中国語=拼音 / ヒンディー語=ローマ字（スペイン語のときは空） */
  reading: string;
  translation: string;
  /** スペイン語のときのみ: 応用文の自然な英訳 */
  english: string;
}

export interface PhrasePattern {
  template: string;
  /** 中国語=拼音 / ヒンディー語=ローマ字（スペイン語のときは空） */
  templateReading: string;
  meaning: string;
  swaps: PhraseSwap[];
  examples: PhraseExample[];
  note: string;
}

export interface PhraseAnalysis {
  normalizedText: string;
  /** 中国語=拼音 / ヒンディー語=ローマ字（スペイン語のときは空） */
  reading: string;
  translation: string;
  /** スペイン語のときのみ: 元の文の自然な英訳 */
  english: string;
  literal: string;
  register: string;
  words: PhraseWord[];
  patterns: PhrasePattern[];
}

export async function fetchPhraseAnalysis(
  targetLanguage: TargetLanguage,
  text: string,
): Promise<PhraseAnalysis> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetLanguage, text }),
  });
  const data: PhraseAnalysis & { error?: string } = await res.json();
  if (!res.ok) throw new Error(data.error ?? "例文の解析に失敗しました。");
  return data;
}
