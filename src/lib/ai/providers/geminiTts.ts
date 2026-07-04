import { generateGeminiSpeech } from "@/lib/gemini";

export interface GeminiTtsProfile {
  voice: string;
  languageName: string;
  accent: string;
}

export const GEMINI_TTS_PROFILES: Record<string, GeminiTtsProfile> = {
  "zh-TW": {
    voice: "Sulafat",
    languageName: "Traditional Mandarin Chinese",
    accent: "Taiwan Mandarin pronunciation",
  },
  "hi-IN": {
    voice: "Achird",
    languageName: "Hindi",
    accent: "natural native Hindi pronunciation from India",
  },
  "es-ES": {
    voice: "Sulafat",
    languageName: "Spanish",
    accent: "clear neutral native Spanish pronunciation",
  },
};

export function geminiVoiceFor(lang: string, requestedVoice?: string): string {
  if (requestedVoice?.trim()) return requestedVoice.trim();
  return (GEMINI_TTS_PROFILES[lang] ?? GEMINI_TTS_PROFILES["hi-IN"]).voice;
}

function buildTtsPrompt(text: string, lang: string): string {
  const profile = GEMINI_TTS_PROFILES[lang] ?? {
    voice: "Sulafat",
    languageName: "the target language",
    accent: "natural native pronunciation",
  };

  return `# AUDIO PROFILE
A friendly native language coach reading a short study sentence for pronunciation practice.

## DIRECTOR'S NOTES
Language: ${profile.languageName}
Accent: ${profile.accent}
Style: Warm, natural, conversational, and human. Avoid robotic narration.
Pacing: Slightly slower than casual speech, with smooth connected pronunciation. Do not over-enunciate.
Task: Read the transcript exactly. Do not translate it. Do not add explanations.

## TRANSCRIPT
${text}`;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function pcmToWavBuffer(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const headerSize = 44;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const arrayBuffer = new ArrayBuffer(headerSize + pcm.byteLength);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, pcm.byteLength, true);
  new Uint8Array(arrayBuffer, headerSize).set(pcm);

  return Buffer.from(arrayBuffer);
}

export async function generateGeminiTtsWav({
  text,
  lang,
  voice,
}: {
  text: string;
  lang: string;
  voice: string;
}): Promise<Buffer> {
  const pcm = await generateGeminiSpeech({
    prompt: buildTtsPrompt(text, lang),
    voice,
  });
  return pcmToWavBuffer(pcm);
}
