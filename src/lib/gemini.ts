const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

interface GeminiTextOptions {
  systemInstruction: string;
  prompt: string;
  maxOutputTokens: number;
  responseSchema?: unknown;
  temperature?: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
    status?: string;
  };
}

interface GeminiSpeechResponse {
  output_audio?: {
    data?: string;
  };
  outputAudio?: {
    data?: string;
  };
  steps?: Array<{
    content?: Array<{
      mime_type?: string;
      mimeType?: string;
      data?: string;
    }>;
  }>;
  error?: {
    message?: string;
    status?: string;
  };
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

function geminiModelPath(): string {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return model.startsWith("models/") ? model : `models/${model}`;
}

function geminiTtsModelName(): string {
  return process.env.GEMINI_TTS_MODEL?.trim() || DEFAULT_GEMINI_TTS_MODEL;
}

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function generateGeminiText({
  systemInstruction,
  prompt,
  maxOutputTokens,
  responseSchema,
  temperature = 0.2,
}: GeminiTextOptions): Promise<string> {
  return generateGeminiContent({
    systemInstruction,
    parts: [{ text: prompt }],
    maxOutputTokens,
    responseSchema,
    responseMimeType: "application/json",
    temperature,
  });
}

export async function generateGeminiContent({
  systemInstruction,
  parts,
  maxOutputTokens,
  responseSchema,
  responseMimeType,
  temperature = 0.2,
}: {
  systemInstruction: string;
  parts: GeminiPart[];
  maxOutputTokens: number;
  responseSchema?: unknown;
  responseMimeType?: "application/json" | "text/plain";
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません。");

  const response = await fetch(`${GEMINI_API_BASE}/${geminiModelPath()}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        candidateCount: 1,
        maxOutputTokens,
        ...(responseMimeType ? { responseMimeType } : {}),
        ...(responseSchema ? { responseSchema } : {}),
        temperature,
      },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as GeminiResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini API request failed (${response.status})`);
  }

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    const reason = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason;
    throw new Error(reason ? `Gemini response was empty: ${reason}` : "Gemini response was empty.");
  }

  return text;
}

export async function generateGeminiSpeech({
  prompt,
  voice,
}: {
  prompt: string;
  voice: string;
}): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません。");

  const response = await fetch(`${GEMINI_API_BASE}/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: geminiTtsModelName(),
      input: prompt,
      response_format: {
        type: "audio",
      },
      generation_config: {
        speech_config: [
          {
            voice,
          },
        ],
      },
    }),
  });

  const data = (await response.json().catch(() => ({}))) as GeminiSpeechResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Gemini TTS request failed (${response.status})`);
  }

  const stepAudio = data.steps
    ?.flatMap((step) => step.content ?? [])
    .find((content) => (content.mime_type ?? content.mimeType ?? "").startsWith("audio/"))?.data;
  const base64Audio = data.output_audio?.data ?? data.outputAudio?.data ?? stepAudio;
  if (!base64Audio) {
    throw new Error("Gemini TTS response was empty.");
  }

  return Buffer.from(base64Audio, "base64");
}
