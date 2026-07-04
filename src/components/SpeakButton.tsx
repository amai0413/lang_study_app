"use client";

import { useEffect, useRef, useState } from "react";

interface SpeakButtonProps {
  text: string;
  lang: string;
  label?: string;
  disabled?: boolean;
  preload?: boolean;
  purpose?: "sentence" | "word";
}

interface SpeechCacheEntry {
  status: "loading" | "ready" | "error";
  promise?: Promise<string>;
  objectUrl?: string;
  error?: string;
}

const speechCache = new Map<string, SpeechCacheEntry>();

function speechCacheKey(text: string, lang: string, purpose: "sentence" | "word") {
  return `${purpose}::${lang}::${text.trim()}`;
}

function getCachedSpeech(text: string, lang: string, purpose: "sentence" | "word"): Promise<string> {
  const key = speechCacheKey(text, lang, purpose);
  const cached = speechCache.get(key);
  if (cached?.objectUrl) return Promise.resolve(cached.objectUrl);
  if (cached?.promise) return cached.promise;

  const promise = fetch("/api/speak", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, lang, purpose, format: "json" }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `TTS request failed (${response.status})`);
      }
      const contentType = response.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const data = (await response.json()) as { audioUrl?: string };
        if (!data.audioUrl) throw new Error("音声URLを取得できませんでした。");
        speechCache.set(key, { status: "ready", objectUrl: data.audioUrl });
        return data.audioUrl;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      speechCache.set(key, { status: "ready", objectUrl });
      return objectUrl;
    })
    .catch((error) => {
      speechCache.set(key, {
        status: "error",
        error: error instanceof Error ? error.message : "自然音声を生成できませんでした。",
      });
      throw error;
    });

  speechCache.set(key, { status: "loading", promise });
  return promise;
}

// Gemini の自然音声が使えない（クォータ切れなど）場合の代替再生。ブラウザ内蔵の音声合成なので機械的だが、必ず何か鳴る。
function speakWithBrowserVoice(text: string, lang: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      reject(new Error("このブラウザでは音声を再生できません。"));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error("音声の再生に失敗しました。"));
    window.speechSynthesis.speak(utterance);
  });
}

export default function SpeakButton({
  text,
  lang,
  label = "音声",
  disabled,
  preload,
  purpose = "sentence",
}: SpeakButtonProps) {
  const canPlayAudio = typeof window !== "undefined" && "Audio" in window;
  const canUseBrowserVoice = typeof window !== "undefined" && "speechSynthesis" in window;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const usingBrowserVoiceRef = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  // 自然音声の成否は「このボタンが今のマウント中に試した結果」だけを表示する。
  // モジュール共有キャッシュの古い error を引きずって、別画面から戻っても
  // 「生成失敗」が残り続けるのを防ぐため。
  const [speechError, setSpeechError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (usingBrowserVoiceRef.current && canUseBrowserVoice) {
        window.speechSynthesis.cancel();
      }
    };
  }, [canUseBrowserVoice]);

  useEffect(() => {
    if (!preload || disabled || !canPlayAudio || !text.trim()) return;
    const key = speechCacheKey(text, lang, purpose);
    const cached = speechCache.get(key);
    if (cached?.status === "ready" || cached?.status === "loading") return;

    getCachedSpeech(text, lang, purpose).catch(() => {
      // Preload is opportunistic. The click handler falls back to the browser voice if needed.
    });
  }, [canPlayAudio, disabled, lang, preload, purpose, text]);

  const stopGeneratedAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (usingBrowserVoiceRef.current && canUseBrowserVoice) {
      window.speechSynthesis.cancel();
      usingBrowserVoiceRef.current = false;
    }
    setIsPlaying(false);
  };

  const handleSpeak = async () => {
    if (disabled || isGenerating || !text.trim()) return;
    stopGeneratedAudio();
    setSpeechError(null);
    setUsedFallback(false);
    setIsGenerating(true);

    if (canPlayAudio) {
      try {
        const audioUrl = await getCachedSpeech(text, lang, purpose);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = stopGeneratedAudio;
        audio.onerror = stopGeneratedAudio;
        setIsGenerating(false);
        setIsPlaying(true);
        await audio.play();
        return;
      } catch {
        // Gemini の自然音声が使えない（クォータ切れなど）。ブラウザ音声にフォールバックする。
      }
    }

    if (!canUseBrowserVoice) {
      setIsGenerating(false);
      setSpeechError("音声を再生できませんでした。");
      return;
    }

    try {
      usingBrowserVoiceRef.current = true;
      setUsedFallback(true);
      setIsGenerating(false);
      setIsPlaying(true);
      await speakWithBrowserVoice(text, lang);
    } catch (error) {
      setSpeechError(error instanceof Error ? error.message : "音声を再生できませんでした。");
    } finally {
      usingBrowserVoiceRef.current = false;
      setIsPlaying(false);
    }
  };

  const isPreloading = preload && speechCache.get(speechCacheKey(text, lang, purpose))?.status === "loading";
  const statusLabel = isGenerating
    ? "生成中"
    : isPlaying
      ? usedFallback
        ? "再生中（簡易）"
        : "再生中"
      : isPreloading
        ? "準備中"
        : speechError
          ? "生成失敗"
          : label;
  const title = isGenerating
    ? "自然音声を生成しています"
    : speechError
      ? speechError
      : isPreloading
        ? "自然音声を先に生成しています"
        : !canPlayAudio && !canUseBrowserVoice
          ? "このブラウザでは音声を再生できません。"
          : "Geminiの自然音声で再生します（利用できない場合はブラウザの音声で再生します）。";

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={disabled || isGenerating || (!canPlayAudio && !canUseBrowserVoice) || !text.trim()}
      className={[
        "inline-flex min-h-9 items-center justify-center rounded-lg border px-3 text-xs font-black shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        speechError
          ? "bn-semantic-bad hover:opacity-90"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-sky-700 dark:hover:bg-sky-950 dark:hover:text-sky-200",
      ].join(" ")}
      aria-label={label}
      title={title}
    >
      <span className="text-base leading-none">♪</span>
      <span className="ml-1 hidden sm:inline">{statusLabel}</span>
    </button>
  );
}
