"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { starterVocabulary, type VocabularyItem } from "@/data/vocabulary";
import { LANGUAGE_LABELS } from "@/lib/languages";
import { speechLanguageFor } from "@/lib/speech";
import { normalizeForMatch, normalizeWordSurface } from "@/lib/textNormalize";
import { loadWords, recordWordPractice, type WordRecord } from "@/lib/wordStore";
import type { TargetLanguage } from "@/types/question";
import SpeakButton from "@/components/SpeakButton";

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

function isCorrect(language: TargetLanguage, input: string, item: VocabularyItem): boolean {
  const answer = normalizeForMatch(language, input);
  const surface = normalizeForMatch(language, item.surface);
  return answer === surface;
}

export default function WordPracticeView({
  language,
  onBack,
  onStatsChange,
  themeToggle,
}: {
  language: TargetLanguage;
  onBack: () => void;
  onStatsChange: () => void;
  themeToggle?: ReactNode;
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
      <div className="min-h-full bg-[#fff7ed] px-5 py-8 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-lg border bg-white p-6 text-center bn-semantic-warn dark:bg-zinc-900">
          <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50">単語練習</h1>
          <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">まだ出題できる単語がありません。</p>
          <div className="grid gap-2">
            {themeToggle}
            <button type="button" onClick={onBack} className="min-h-11 rounded-lg bg-zinc-950 text-sm font-black text-white">
              ホームに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  const progress = Math.round((remaining / WORD_TIME_LIMIT) * 100);

  return (
    <div className="min-h-full bg-[#fff7ed] px-4 py-5 dark:bg-zinc-950 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide bn-text-warn">Flash Cards</p>
            <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50">{LANGUAGE_LABELS[language]} 単語練習</h1>
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              正解 {correctCount} / {attempts}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {themeToggle}
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg px-3 py-2 text-xs font-black text-zinc-500 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              ホームへ
            </button>
          </div>
        </header>

        <div className="rounded-lg border bg-white p-3 shadow-sm bn-semantic-warn dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black">残り時間</p>
            <p className="text-xl font-black tabular-nums text-zinc-950 dark:text-zinc-50">0:{remaining.toString().padStart(2, "0")}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bn-warn-bg-strong)]">
            <div className="h-full rounded-full bg-[var(--bn-warn-solid)] transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <section className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <p className="text-sm font-black text-zinc-400">この日本語に対応する単語は？</p>
          <h2 className="mt-5 text-4xl font-black text-zinc-950 dark:text-zinc-50 sm:text-5xl">{current.meaning}</h2>
          <p className="mt-3 text-sm font-bold text-zinc-400">{current.pos || "単語"}</p>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSubmit();
            }}
            disabled={Boolean(result)}
            autoFocus
            placeholder={`${LANGUAGE_LABELS[language]}で入力`}
            className="min-h-12 w-full rounded-lg border border-zinc-300 px-4 text-lg font-black text-zinc-950 outline-none focus:border-[var(--bn-warn-border)] disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:disabled:bg-zinc-900"
          />

          {result ? (
            <div
              className={`mt-3 rounded-lg border p-4 text-left ${
                result === "correct" ? "bn-semantic-good" : "bn-semantic-bad"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black">{result === "correct" ? "正解" : "復習"}</p>
                  <p className="mt-1 break-words text-2xl font-black">{current.surface}</p>
                  <p className="mt-1 text-sm font-bold opacity-80">
                    {current.reading ? `${current.reading} / ` : ""}
                    {current.meaning}
                  </p>
                </div>
                <SpeakButton
                  text={current.surface}
                  lang={speechLanguageFor(language)}
                  label="音声"
                  purpose="word"
                />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={result ? handleNext : handleSubmit}
            disabled={!result && input.trim().length === 0}
            className="mt-3 min-h-12 w-full rounded-lg bg-zinc-950 text-base font-black text-white transition-colors hover:bg-[var(--bn-warn-solid)] disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-[var(--bn-warn-solid)]"
          >
            {result ? "次の単語" : "答える"}
          </button>
        </section>
      </div>
    </div>
  );
}
