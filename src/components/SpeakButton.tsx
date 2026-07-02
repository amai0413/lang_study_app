"use client";

import { useEffect, useMemo, useState } from "react";

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

  const handleSpeak = () => {
    if (!canSpeak || disabled || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.voice = selectedVoice ?? null;
    utterance.rate = 0.88;
    utterance.pitch = 1.04;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={disabled || !canSpeak || !text.trim()}
      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-black text-zinc-600 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title={
        canSpeak
          ? selectedVoice
            ? `${label}: ${selectedVoice.name}`
            : `${label}: 対象言語の音声が見つからないためデフォルト音声を使います`
          : "このブラウザでは読み上げに対応していません"
      }
    >
      <span className="text-base leading-none">♪</span>
      <span className="ml-1 hidden sm:inline">{label}</span>
    </button>
  );
}
