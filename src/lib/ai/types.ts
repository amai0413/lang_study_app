import type { TargetLanguage } from "@/types/question";

export type AudioPurpose = "sentence" | "word";
export type AudioStatus = "none" | "generating" | "ready" | "failed";
export type AudioProviderName = "gemini" | "amazon-polly" | "browser" | "unknown";
export type AudioRate = "slow" | "medium" | "fast";
export type AudioExtension = "wav" | "mp3";

export interface StoredAudioMetadata {
  audioUrl: string;
  provider: AudioProviderName;
  voiceId?: string;
  rate?: AudioRate | string;
  cacheKey: string;
  createdAt: string;
}

export interface SpeakInput {
  text: string;
  lang: string;
  purpose?: AudioPurpose;
  voiceId?: string;
  rate?: AudioRate | string;
}

export interface SpeakResult extends StoredAudioMetadata {
  cached: boolean;
  extension: AudioExtension;
  contentType: string;
}

export const DEFAULT_AUDIO_RATE: AudioRate = "medium";

export const TARGET_LANGUAGE_TO_SPEECH_LANG: Record<TargetLanguage, string> = {
  zh: "zh-TW",
  hi: "hi-IN",
  es: "es-ES",
};

export function speechLangForAudio(lang: string): string {
  const trimmed = lang.trim();
  if (trimmed in TARGET_LANGUAGE_TO_SPEECH_LANG) {
    return TARGET_LANGUAGE_TO_SPEECH_LANG[trimmed as TargetLanguage];
  }
  return trimmed || "hi-IN";
}

export function targetLanguageFromSpeechLang(lang: string): TargetLanguage | null {
  const normalized = speechLangForAudio(lang).toLowerCase();
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("hi")) return "hi";
  if (normalized.startsWith("es")) return "es";
  return null;
}
