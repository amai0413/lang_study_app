const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

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

function geminiModelPath(): string {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return model.startsWith("models/") ? model : `models/${model}`;
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
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        candidateCount: 1,
        maxOutputTokens,
        responseMimeType: "application/json",
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
