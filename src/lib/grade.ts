import type { Question } from "@/types/question";

export type GradeStatus = "correct" | "acceptable" | "close" | "incorrect";

export interface WordEntry {
  surface: string;
  reading: string;
  meaning: string;
  pos: string;
}

export interface GradeResult {
  status: GradeStatus;
  feedback: string;
  /** acceptable / close のとき、より自然な言い方 */
  betterExpression?: string;
  explanationMarkdown: string;
  /** DB格納用: この問題・解説に登場した単語 */
  words?: WordEntry[];
  /** DB格納用: 使われた文法・構文タグ */
  grammarItems?: string[];
}

export async function fetchGrade(question: Question, userAnswer: string): Promise<GradeResult> {
  const res = await fetch("/api/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetLanguage: question.targetLanguage,
      level: question.level,
      japanesePrompt: question.japanesePrompt,
      strictAnswer: question.strictAnswer,
      acceptedAnswers: question.acceptedAnswers,
      grammarPoint: question.grammarPoint,
      userAnswer,
    }),
  });
  const data: GradeResult & { error?: string } = await res.json();
  if (!res.ok) throw new Error(data.error ?? "採点に失敗しました。");
  return data;
}
