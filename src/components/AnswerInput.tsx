"use client";

import { useEffect, useRef, useState } from "react";
import type { TargetLanguage } from "@/types/question";
import { speechLanguageFor } from "@/lib/speech";

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  language: TargetLanguage;
  disabled?: boolean;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export default function AnswerInput({ value, onChange, language, disabled }: AnswerInputProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseValueRef = useRef("");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const canListen = Boolean(getSpeechRecognition());

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleSpeech = () => {
    if (disabled || !canListen) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = speechLanguageFor(language);
    recognition.interimResults = true;
    recognition.continuous = false;
    baseValueRef.current = value.trim();
    setSpeechError(null);

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0]?.transcript ?? "";
      }
      const prefix = baseValueRef.current ? `${baseValueRef.current} ` : "";
      onChange(`${prefix}${transcript}`.trim());
    };
    recognition.onerror = () => {
      setSpeechError("音声を認識できませんでした。");
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder="ここに回答を入力してください。"
          rows={3}
          className="min-h-28 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 pr-24 text-base font-semibold text-zinc-900 outline-none transition-colors placeholder:font-medium placeholder:text-zinc-400 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-400"
        />
        <button
          type="button"
          onClick={handleSpeech}
          disabled={disabled || !canListen}
          className={[
            "absolute right-3 top-3 min-h-9 rounded-lg px-3 text-xs font-black shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            isListening
              ? "bg-rose-600 text-white hover:bg-rose-700"
              : "border border-zinc-200 bg-white text-zinc-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
          ].join(" ")}
          title={canListen ? "音声で回答" : "このブラウザでは音声認識に対応していません"}
        >
          {isListening ? "停止" : "音声"}
        </button>
      </div>
      {speechError ? <p className="text-xs font-bold text-rose-600">{speechError}</p> : null}
    </div>
  );
}
