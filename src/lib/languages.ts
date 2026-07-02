import { TARGET_LANGUAGES, type TargetLanguage } from "@/types/question";

export { TARGET_LANGUAGES };

export const LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  zh: "中国語",
  hi: "ヒンディー語",
  es: "スペイン語",
};

export const LANGUAGE_GENERATION_LABELS: Record<TargetLanguage, string> = {
  zh: "中国語（繁体字のみ。簡体字は使わない）",
  hi: "ヒンディー語（デーヴァナーガリー文字）",
  es: "スペイン語（ラテンアメリカ標準寄り。自然な地域差は可）",
};

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return typeof value === "string" && (TARGET_LANGUAGES as readonly string[]).includes(value);
}

export function targetLanguageListLabel(): string {
  return TARGET_LANGUAGES.map((lang) => `'${lang}'`).join("、");
}
