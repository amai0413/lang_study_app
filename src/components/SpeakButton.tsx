"use client";

interface SpeakButtonProps {
  text: string;
  lang: string;
  label?: string;
  disabled?: boolean;
}

export default function SpeakButton({ text, lang, label = "音声", disabled }: SpeakButtonProps) {
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  const handleSpeak = () => {
    if (!canSpeak || disabled || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.92;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      disabled={disabled || !canSpeak || !text.trim()}
      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-black text-zinc-600 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title={canSpeak ? label : "このブラウザでは読み上げに対応していません"}
    >
      <span className="text-base leading-none">♪</span>
      <span className="ml-1 hidden sm:inline">{label}</span>
    </button>
  );
}
