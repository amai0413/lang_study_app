import OpenCC from "opencc-js/cn2t";
import type { TargetLanguage } from "@/types/question";

const toTraditional = OpenCC.Converter({ from: "cn", to: "tw" });

export function toTraditionalChinese(text: string): string {
  return toTraditional(text);
}

export function normalizeWordSurface(language: TargetLanguage, surface: string): string {
  const trimmed = surface.trim().normalize("NFC");
  if (language === "zh") return toTraditionalChinese(trimmed);
  if (language === "es") return trimmed.toLocaleLowerCase("es");
  return trimmed;
}

export function wordRecordKey(language: TargetLanguage, surface: string): string {
  return `${language}:${normalizeWordSurface(language, surface)}`;
}
