"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface SpeakButtonProps {
  text: string;
  lang: string;
  label?: string;
  disabled?: boolean;
}

function voiceScore(voice: SpeechSynthesisVoice, lang: string): number {
  const voiceLang = voice.lang.toLowerCase();
  const target = lang.toLowerCase();
  const baseLang = target.split("-")[0];
  const name = voice.name.toLowerCase();
  let score = 0;
  if (voiceLang === target) score += 80;
  if (voiceLang.startsWith(`${baseLang}-`)) score += 45;
  if (name.includes("google")) score += 24;
  if (name.includes("microsoft")) score += 22;
  if (name.includes("apple")) score += 18;
  if (name.includes("premium") || name.includes("enhanced") || name.includes("neural")) score += 18;
  if (name.includes("mei-jia") || name.includes("ting-ting") || name.includes("sin-ji")) score += 20;
  if (name.includes("monica") || name.includes("paulina") || name.includes("jorge")) score += 16;
  if (name.includes("lekha") || name.includes("hindi")) score += 16;
  if (voice.localService) score += 4;
  if (voice.default) score += 2;
  return score;
}

function bestVoice(lang: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices
    .filter((voice) => voice.lang.toLowerCase().startsWith(lang.toLowerCase().split("-")[0]))
    .sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang))[0];
}

export default function SpeakButton({ text, lang, label = "音声", disabled }: SpeakButtonProps) {
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const canPlayAudio = typeof window !== "undefined" && "Audio" in window;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    typeof window !== "undefined" && "speechSynthesis" in window
      ? window.speechSynthesis.getVoices()
      : [],
  );
  const selectedVoice = useMemo(() => bestVoice(lang, voices), [lang, voices]);

  useEffect(() => {
    if (!canSpeak) return;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    const id = window.setTimeout(loadVoices, 0);
    return () => {
      window.clearTimeout(id);
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, [canSpeak]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const stopGeneratedAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
  };

  const playBrowserSpeech = () => {
    if (!canSpeak || disabled || !text.trim()) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.voice = selectedVoice ?? null;
    utterance.rate = 0.88;
    utterance.pitch = 1.04;
    window.speechSynthesis.speak(utterance);
    return true;
  };

  const handleSpeak = async () => {
    if (disabled || isGenerating || !text.trim()) return;
    stopGeneratedAudio();
    if (canSpeak) window.speechSynthesis.cancel();

    if (!canPlayAudio) {
      playBrowserSpeech();
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, lang }),
      });
      if (!response.ok) throw new Error(`TTS request failed (${response.status})`);

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      objectUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = stopGeneratedAudio;
      audio.onerror = stopGeneratedAudio;
      setIsGenerating(false);
      setIsPlaying(true);
      await audio.play();
    } catch (error) {
      console.warn("[SpeakButton] Gemini TTS fallback:", error);
      setIsGenerating(false);
      stopGeneratedAudio();
      playBrowserSpeech();
    }
  };

  const statusLabel = isGenerating ? "生成中" : isPlaying ? "再生中" : label;
  const title = isGenerating
    ? "自然音声を生成しています"
    : "Geminiの自然音声で再生します。失敗した場合だけブラウザ音声を使います。";

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={disabled || isGenerating || (!canPlayAudio && !canSpeak) || !text.trim()}
      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-black text-zinc-600 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title={title}
    >
      <span className="text-base leading-none">♪</span>
      <span className="ml-1 hidden sm:inline">{statusLabel}</span>
    </button>
  );
}
