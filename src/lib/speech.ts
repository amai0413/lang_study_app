import type { Level, TargetLanguage } from "@/types/question";

export const SPEECH_LANGUAGE_CODES: Record<TargetLanguage, string> = {
  zh: "zh-TW",
  hi: "hi-IN",
  es: "es-ES",
};

export const ANSWER_TIME_LIMIT_SECONDS: Record<Level, number> = {
  A1: 35,
  A2: 45,
  B1: 60,
  B2: 75,
};

export function speechLanguageFor(language: TargetLanguage): string {
  return SPEECH_LANGUAGE_CODES[language];
}
