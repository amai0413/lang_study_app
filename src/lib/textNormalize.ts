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

/** 表記ゆれ（アクセント・句読点・大小文字）を吸収した、緩い一致判定用の正規化。 */
export function normalizeForMatch(language: TargetLanguage, value: string): string {
  return normalizeWordSurface(language, value)
    .toLocaleLowerCase(language === "es" ? "es" : undefined)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[。！？!?.,，、¿¡「」『』"'()\[\]]/g, "")
    .trim();
}
