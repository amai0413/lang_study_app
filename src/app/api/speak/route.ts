import { NextRequest, NextResponse } from "next/server";
import { generateGeminiSpeech, hasGeminiApiKey } from "@/lib/gemini";

const MAX_TTS_TEXT_LENGTH = 500;

interface SpeakBody {
  text?: string;
  lang?: string;
}

const TTS_PROFILES: Record<
  string,
  {
    voice: string;
    languageName: string;
    accent: string;
  }
> = {
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

function buildTtsPrompt(text: string, lang: string): string {
  const profile = TTS_PROFILES[lang] ?? {
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

function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): ArrayBuffer {
  const headerSize = 44;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(headerSize + pcm.byteLength);
  const view = new DataView(buffer);

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
  new Uint8Array(buffer, headerSize).set(pcm);

  return buffer;
}

export async function POST(request: NextRequest) {
  if (!hasGeminiApiKey()) {
    return NextResponse.json({ error: "GEMINI_API_KEY が設定されていません。" }, { status: 500 });
  }

  let body: SpeakBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました。" }, { status: 400 });
  }

  const text = body.text?.trim();
  const lang = body.lang?.trim() || "hi-IN";
  if (!text) {
    return NextResponse.json({ error: "text がありません。" }, { status: 400 });
  }
  if (text.length > MAX_TTS_TEXT_LENGTH) {
    return NextResponse.json({ error: "読み上げる文章が長すぎます。" }, { status: 400 });
  }

  try {
    const profile = TTS_PROFILES[lang] ?? TTS_PROFILES["hi-IN"];
    const pcm = await generateGeminiSpeech({
      prompt: buildTtsPrompt(text, lang),
      voice: profile.voice,
    });
    const wav = pcmToWav(pcm);

    return new NextResponse(wav, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "audio/wav",
      },
    });
  } catch (error) {
    console.error("[/api/speak]", error);
    return NextResponse.json({ error: "音声生成に失敗しました。" }, { status: 500 });
  }
}
