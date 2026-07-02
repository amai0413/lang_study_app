"use client";

import { useEffect, useRef, useState } from "react";
import type { TargetLanguage } from "@/types/question";

interface SpeechInputProps {
  targetLanguage: TargetLanguage;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const RECOGNITION_LANG: Record<TargetLanguage, string> = {
  zh: "zh-TW",
  hi: "hi-IN",
};

export default function SpeechInput({
  targetLanguage,
  value,
  onChange,
  disabled,
}: SpeechInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  useEffect(() => {
    // Browser API detection must run post-mount to avoid SSR/hydration mismatch
    const ctor = typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(!!ctor);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleToggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const ctor = typeof window !== "undefined" ? window.SpeechRecognition ?? window.webkitSpeechRecognition : undefined;
    if (!ctor) {
      setIsSupported(false);
      return;
    }

    const recognition = new ctor();
    recognition.lang = RECOGNITION_LANG[targetLanguage];
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript;
      onChange(transcript);
    };
    recognition.onerror = (event) => {
      setSpeechError(`音声認識でエラーが発生しました（${event.error}）。手入力をご利用ください。`);
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    setSpeechError(null);
    setIsRecording(true);
    recognition.start();
  };

  return (
    <div className="flex flex-col gap-3">
      {isSupported ? (
        <button
          type="button"
          onClick={handleToggleRecording}
          disabled={disabled}
          className={`min-h-12 w-full rounded-xl text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isRecording ? "bg-rose-600" : "bg-zinc-900"
          }`}
        >
          {isRecording ? "● 録音中…（タップで停止）" : "🎙 録音開始"}
        </button>
      ) : (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          このブラウザでは音声認識が使えないため、手入力してください。
        </p>
      )}

      {speechError ? <p className="text-sm text-rose-600">{speechError}</p> : null}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="認識結果がここに表示されます。手入力での修正・入力も可能です。"
        rows={2}
        className="min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus:border-zinc-500 disabled:bg-zinc-50 disabled:text-zinc-400"
      />
    </div>
  );
}
