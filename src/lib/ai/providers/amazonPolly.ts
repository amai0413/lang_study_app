import { PollyClient, SynthesizeSpeechCommand, type VoiceId } from "@aws-sdk/client-polly";

interface PollyProfile {
  voice: VoiceId;
  languageCode: string;
}

// 学習対象言語ごとの Polly ニューラルボイス。
// zh は台湾華語専用ボイスが無いため標準中国語の Zhiyu を使う（繁体字もそのまま読める）。
export const POLLY_PROFILES: Record<string, PollyProfile> = {
  "zh-TW": { voice: "Zhiyu", languageCode: "cmn-CN" },
  "hi-IN": { voice: "Kajal", languageCode: "hi-IN" },
  "es-ES": { voice: "Lucia", languageCode: "es-ES" },
};

export function pollyVoiceFor(lang: string, requestedVoice?: string): string {
  if (requestedVoice?.trim()) return requestedVoice.trim();
  return (POLLY_PROFILES[lang] ?? POLLY_PROFILES["hi-IN"]).voice;
}

export function hasPollyCredentials(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() && process.env.AWS_SECRET_ACCESS_KEY?.trim(),
  );
}

let pollyClient: PollyClient | null = null;

function getPollyClient(): PollyClient {
  if (!pollyClient) {
    pollyClient = new PollyClient({
      region: process.env.AWS_REGION?.trim() || "us-east-1",
    });
  }
  return pollyClient;
}

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const SSML_RATES = new Set(["x-slow", "slow", "medium", "fast", "x-fast"]);

export async function generatePollyTtsMp3({
  text,
  lang,
  voice,
  rate = "medium",
}: {
  text: string;
  lang: string;
  voice?: string;
  rate?: string;
}): Promise<Buffer> {
  if (!hasPollyCredentials()) {
    throw new Error("AWS認証情報（AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY）が設定されていません。");
  }

  const profile = POLLY_PROFILES[lang] ?? POLLY_PROFILES["hi-IN"];
  const voiceId = (voice?.trim() || profile.voice) as VoiceId;
  const ssmlRate = SSML_RATES.has(rate) ? rate : "medium";

  try {
    const response = await getPollyClient().send(
      new SynthesizeSpeechCommand({
        Engine: "neural",
        OutputFormat: "mp3",
        VoiceId: voiceId,
        LanguageCode: profile.languageCode as never,
        TextType: "ssml",
        Text: `<speak><prosody rate="${ssmlRate}">${escapeSsml(text)}</prosody></speak>`,
      }),
    );
    if (!response.AudioStream) {
      throw new Error("Polly TTS response was empty.");
    }
    const bytes = await response.AudioStream.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    // 既存のクォータ検知（message に "quota" を含むか）に乗せるため、スロットリングは書き換えて投げ直す。
    if (error instanceof Error && error.name === "ThrottlingException") {
      throw new Error("Polly quota/rate exceeded (ThrottlingException)");
    }
    throw error;
  }
}
