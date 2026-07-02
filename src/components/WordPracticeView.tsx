"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { starterVocabulary, type VocabularyItem } from "@/data/vocabulary";
import { LANGUAGE_LABELS } from "@/lib/languages";
import { normalizeWordSurface } from "@/lib/textNormalize";
import { loadWords, recordWordPractice, type WordRecord } from "@/lib/wordStore";
import type { TargetLanguage } from "@/types/question";

const WORD_TIME_LIMIT = 10;

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function fromRecord(record: WordRecord): VocabularyItem {
  return {
    lang: record.lang,
    surface: record.surface,
    reading: record.reading,
    meaning: record.meaning,
    pos: record.pos,
  };
}

function normalizeAnswer(language: TargetLanguage, value: string): string {
  return normalizeWordSurface(language, value)
    .toLocaleLowerCase(language === "es" ? "es" : undefined)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[。！？!?.,，、¿¡]/g, "")
    .trim();
}

function isCorrect(language: TargetLanguage, input: string, item: VocabularyItem): boolean {
  const answer = normalizeAnswer(language, input);
  const surface = normalizeAnswer(language, item.surface);
  return answer === surface;
}

export default function WordPracticeView({
  language,
  onBack,
  onStatsChange,
}: {
  language: TargetLanguage;
  onBack: () => void;
  onStatsChange: () => void;
}) {
  const [storedWords] = useState<WordRecord[]>(() => loadWords());
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [remaining, setRemaining] = useState(WORD_TIME_LIMIT);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const finishedRef = useRef(false);

  const deck = useMemo(() => {
    const existing = storedWords
      .filter((word) => word.lang === language)
      .filter((word) => word.meaning && word.surface)
      .map(fromRecord);
    const starter = starterVocabulary.filter((word) => word.lang === language);
    const bySurface = new Map<string, VocabularyItem>();
    for (const item of [...existing, ...starter]) {
      bySurface.set(normalizeWordSurface(language, item.surface), item);
    }
    return shuffle([...bySurface.values()]);
  }, [language, storedWords]);

  const current = deck[index % Math.max(deck.length, 1)];

  const finish = useCallback((remembered: boolean) => {
    if (!current || finishedRef.current) return;
    finishedRef.current = true;
    setResult(remembered ? "correct" : "incorrect");
    setAttempts((value) => value + 1);
    if (remembered) setCorrectCount((value) => value + 1);
    recordWordPractice(language, current, remembered);
    onStatsChange();
  }, [current, language, onStatsChange]);

  useEffect(() => {
    if (result || remaining <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.setTimeout(() => finish(false), 0);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [finish, remaining, result]);

  const handleSubmit = () => {
    if (!current || result) return;
    finish(isCorrect(language, input, current));
  };

  const handleNext = () => {
    finishedRef.current = false;
    setRemaining(WORD_TIME_LIMIT);
    setResult(null);
    setInput("");
    setIndex((value) => value + 1);
  };

  if (!current) {
    return (
      <div className="min-h-full bg-[#fff7ed] px-5 py-8">
        <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-lg border border-amber-200 bg-white p-6 text-center">
          <h1 className="text-2xl font-black text-zinc-950">単語練習</h1>
          <p className="text-sm font-bold text-zinc-500">まだ出題できる単語がありません。</p>
          <button type="button" onClick={onBack} className="min-h-11 rounded-lg bg-zinc-950 text-sm font-black text-white">
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  const progress = Math.round((remaining / WORD_TIME_LIMIT) * 100);

  return (
    <div className="min-h-full bg-[#fff7ed] px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-amber-600">Flash Cards</p>
            <h1 className="text-2xl font-black text-zinc-950">{LANGUAGE_LABELS[language]} 単語練習</h1>
            <p className="text-xs font-bold text-zinc-500">
              正解 {correctCount} / {attempts}
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg px-3 py-2 text-xs font-black text-zinc-500 hover:bg-white"
          >
            ホームへ
          </button>
        </header>

        <div className="rounded-lg border border-amber-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-amber-700">残り時間</p>
            <p className="text-xl font-black tabular-nums text-zinc-950">0:{remaining.toString().padStart(2, "0")}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100">
            <div className="h-full rounded-full bg-amber-500 transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <section className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <p className="text-sm font-black text-zinc-400">この日本語に対応する単語は？</p>
          <h2 className="mt-5 text-4xl font-black text-zinc-950 sm:text-5xl">{current.meaning}</h2>
          <p className="mt-3 text-sm font-bold text-zinc-400">{current.pos || "単語"}</p>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSubmit();
            }}
            disabled={Boolean(result)}
            autoFocus
            placeholder={`${LANGUAGE_LABELS[language]}で入力`}
            className="min-h-12 w-full rounded-lg border border-zinc-300 px-4 text-lg font-black text-zinc-950 outline-none focus:border-amber-500 disabled:bg-zinc-50"
          />

          {result ? (
            <div
              className={`mt-3 rounded-lg border p-4 text-left ${
                result === "correct"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              <p className="text-sm font-black">{result === "correct" ? "正解" : "復習"}</p>
              <p className="mt-1 text-2xl font-black">{current.surface}</p>
              <p className="mt-1 text-sm font-bold opacity-80">
                {current.reading ? `${current.reading} / ` : ""}
                {current.meaning}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={result ? handleNext : handleSubmit}
            disabled={!result && input.trim().length === 0}
            className="mt-3 min-h-12 w-full rounded-lg bg-zinc-950 text-base font-black text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {result ? "次の単語" : "答える"}
          </button>
        </section>
      </div>
    </div>
  );
}
