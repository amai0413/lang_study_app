import crypto from "crypto";
import type { AudioProviderName, AudioPurpose, SpeakInput, SpeakResult } from "@/lib/ai/types";
import {
  DEFAULT_AUDIO_RATE,
  speechLangForAudio,
  targetLanguageFromSpeechLang,
} from "@/lib/ai/types";
import {
  generatePollyTtsMp3,
  hasPollyCredentials,
  pollyVoiceFor,
} from "@/lib/ai/providers/amazonPolly";
import { generateGeminiTtsWav, geminiVoiceFor } from "@/lib/ai/providers/geminiTts";
import { hasGeminiApiKey } from "@/lib/gemini";
import {
  findLocalAudio,
  readLocalAudio,
  writeLocalAudio,
  type AudioStorageFile,
} from "@/lib/ai/storage/localAudioStorage";
import { normalizeWordSurface } from "@/lib/textNormalize";

const DEFAULT_PURPOSE: AudioPurpose = "sentence";

export type TtsProvider = Extract<AudioProviderName, "amazon-polly" | "gemini">;

/** TTS_PROVIDER で明示指定。未指定なら AWS 認証があれば Polly、無ければ Gemini。 */
export function activeTtsProvider(): TtsProvider {
  const requested = process.env.TTS_PROVIDER?.trim().toLowerCase();
  if (requested === "polly" || requested === "amazon-polly") return "amazon-polly";
  if (requested === "gemini") return "gemini";
  return hasPollyCredentials() ? "amazon-polly" : "gemini";
}

/** 現在の TTS プロバイダの認証情報が揃っているか（ルートの事前ガード用）。 */
export function hasTtsCredentials(): boolean {
  return activeTtsProvider() === "amazon-polly" ? hasPollyCredentials() : hasGeminiApiKey();
}

export function ttsCredentialsErrorMessage(): string {
  return activeTtsProvider() === "amazon-polly"
    ? "AWS認証情報（AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY）が設定されていません。"
    : "GEMINI_API_KEY が設定されていません。";
}

function defaultVoiceFor(provider: TtsProvider, lang: string): string {
  return provider === "amazon-polly" ? pollyVoiceFor(lang) : geminiVoiceFor(lang);
}

function normalizeAudioText(text: string, lang: string, purpose: AudioPurpose): string {
  const compact = text.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (purpose !== "word") return compact;

  const targetLanguage = targetLanguageFromSpeechLang(lang);
  return targetLanguage ? normalizeWordSurface(targetLanguage, compact) : compact;
}

export function audioCacheKey({
  text,
  lang,
  purpose = DEFAULT_PURPOSE,
  voiceId,
  rate = DEFAULT_AUDIO_RATE,
}: SpeakInput): string {
  const provider = activeTtsProvider();
  const speechLang = speechLangForAudio(lang);
  const voice = voiceId?.trim() || defaultVoiceFor(provider, speechLang);
  const normalizedText = normalizeAudioText(text, speechLang, purpose);
  return crypto
    .createHash("sha256")
    .update(`${purpose}:${speechLang}:${voice}:${rate}:${normalizedText}`)
    .digest("hex");
}

function resultFromFile({
  file,
  cached,
  provider,
  voiceId,
  rate,
}: {
  file: AudioStorageFile;
  cached: boolean;
  provider: SpeakResult["provider"];
  voiceId: string;
  rate: string;
}): SpeakResult {
  return {
    provider,
    cached,
    audioUrl: file.audioUrl,
    cacheKey: file.cacheKey,
    voiceId,
    rate,
    createdAt: new Date().toISOString(),
    extension: file.extension,
    contentType: file.contentType,
  };
}

export async function getOrCreateSpeech(input: SpeakInput): Promise<SpeakResult> {
  const provider = activeTtsProvider();
  const text = input.text.trim();
  const lang = speechLangForAudio(input.lang);
  const purpose = input.purpose ?? DEFAULT_PURPOSE;
  const rate = input.rate ?? DEFAULT_AUDIO_RATE;
  const voiceId = input.voiceId?.trim() || defaultVoiceFor(provider, lang);
  const cacheKey = audioCacheKey({ ...input, text, lang, purpose, voiceId, rate });
  const cachedFile = await findLocalAudio(cacheKey);
  if (cachedFile) {
    return resultFromFile({
      file: cachedFile,
      cached: true,
      provider,
      voiceId,
      rate,
    });
  }

  const file =
    provider === "amazon-polly"
      ? await writeLocalAudio(
          cacheKey,
          await generatePollyTtsMp3({ text, lang, voice: voiceId, rate }),
          "mp3",
        )
      : await writeLocalAudio(
          cacheKey,
          await generateGeminiTtsWav({ text, lang, voice: voiceId }),
          "wav",
        );

  return resultFromFile({
    file,
    cached: false,
    provider,
    voiceId,
    rate,
  });
}

export async function readCachedSpeech(result: SpeakResult): Promise<Buffer | null> {
  const file = await findLocalAudio(result.cacheKey);
  return file ? readLocalAudio(file) : null;
}
