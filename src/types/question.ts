export type Level = "A1" | "A2" | "B1" | "B2";
export type TargetLanguage = "zh" | "hi";

export interface CommonMistake {
  answer: string;
  result: "close" | "incorrect";
  feedback: string;
}

export interface Question {
  id: string;
  level: Level;
  targetLanguage: TargetLanguage;
  /** 出題元のカリキュラム文法項目ID（習得度記録に使う） */
  grammarItemId?: string;
  japanesePrompt: string;
  strictAnswer: string;
  acceptedAnswers: string[];
  requiredKeywords: string[];
  grammarPoint: string;
  explanationMarkdown?: string;
  commonMistakes: CommonMistake[];
}
