"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetchPhraseAnalysis, type PhraseAnalysis, type PhrasePattern } from "@/lib/analyze";
import { backfillMissingWordAudio } from "@/lib/audioBackfill";
import { LANGUAGE_LABELS } from "@/lib/languages";
import { speechLanguageFor } from "@/lib/speech";
import { normalizeWordSurface } from "@/lib/textNormalize";
import { registerPhraseWords, type PhraseWordStatus } from "@/lib/wordStore";
import type { TargetLanguage } from "@/types/question";
import SpeakButton from "@/components/SpeakButton";
import WordCard, { type WordCardStatus } from "@/components/WordCard";

const PLACEHOLDERS: Record<TargetLanguage, string> = {
  zh: "例: 明天有空嗎？一起去喝咖啡吧！",
  hi: "例: कल टाइम है क्या? कॉफी पीने चलें!",
  es: "例: ¿Tienes tiempo mañana? ¡Vamos por un café!",
};

function toWordCardStatus(status: PhraseWordStatus): WordCardStatus {
  return status === "new" ? "unknown" : status;
}

export default function PhraseRegisterView({
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
  const [input, setInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PhraseAnalysis | null>(null);
  const [statuses, setStatuses] = useState<Record<string, PhraseWordStatus>>({});

  const speechLang = speechLanguageFor(language);

  const handleAnalyze = async () => {
    const text = input.trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await fetchPhraseAnalysis(language, text);
      // 保存「前」の状態でステータスを判定してから登録する（初見語は「確認」で保存）
      const wordStatuses = registerPhraseWords(language, result.words);
      setAnalysis(result);
      setStatuses(wordStatuses);
      onStatsChange();
      // 音声が未生成の単語は裏で自動生成する（失敗してもUIは止めない）
      backfillMissingWordAudio(language, result.words.map((word) => word.surface));
    } catch (err) {
      setError(err instanceof Error ? err.message : "例文の解析に失敗しました。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setAnalysis(null);
    setStatuses({});
    setError(null);
    setInput("");
  };

  const newCount = useMemo(
    () => Object.values(statuses).filter((status) => status === "new").length,
    [statuses],
  );

  return (
    <div className="min-h-full bg-[#fff7ed] dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-screen-2xl min-w-0 flex-col gap-5 p-3 sm:p-4 lg:p-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide bn-text-good">Phrase Book</p>
            <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50">
              {LANGUAGE_LABELS[language]} 例文登録
            </h1>
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              受け取った文を貼り付けて、単語・型・音声で覚える
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

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <label htmlFor="phrase-input" className="text-sm font-black text-zinc-700 dark:text-zinc-200">
            登録する文（{LANGUAGE_LABELS[language]}）
          </label>
          <textarea
            id="phrase-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) handleAnalyze();
            }}
            disabled={isAnalyzing}
            rows={3}
            placeholder={PLACEHOLDERS[language]}
            className="mt-2 min-h-24 w-full resize-y rounded-lg border border-zinc-300 px-4 py-3 text-lg font-bold text-zinc-950 outline-none focus:border-[var(--bn-good-border)] disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:disabled:bg-zinc-900"
          />
          <button
            type="button"
            onClick={analysis ? handleReset : handleAnalyze}
            disabled={!analysis && (input.trim().length === 0 || isAnalyzing)}
            className="mt-3 min-h-12 w-full rounded-lg bg-zinc-950 text-base font-black text-white transition-colors hover:bg-[var(--bn-good-solid)] disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-[var(--bn-good-solid)] dark:hover:text-zinc-950 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-300"
          >
            {analysis ? "別の文を登録" : isAnalyzing ? "解析中…" : "解析して登録する"}
          </button>
          {error ? <p className="mt-2 text-center text-xs font-bold bn-text-bad">{error}</p> : null}
        </section>

        {isAnalyzing && !analysis ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-black bn-text-good">AI が例文を解析しています</p>
            <div className="mt-4 flex flex-col gap-2">
              <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--bn-good-bg-strong)]" />
              <div className="h-3 w-full animate-pulse rounded-full bg-[var(--bn-warn-bg-strong)]" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
            </div>
          </div>
        ) : null}

        {analysis ? (
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <div className="flex min-w-0 flex-col gap-5">
              <PhraseSummary analysis={analysis} language={language} speechLang={speechLang} />

              {newCount > 0 ? (
                <p className="rounded-lg border px-4 py-2 text-sm font-black bn-semantic-good">
                  {newCount} 語を新しく登録しました（確認）
                </p>
              ) : (
                <p className="rounded-lg border px-4 py-2 text-sm font-black bn-semantic-warn">
                  すべて登録済みの単語でした。復習に使えます。
                </p>
              )}

              <WordCards analysis={analysis} statuses={statuses} language={language} />
            </div>

            {analysis.patterns.length > 0 ? (
              <section className="flex min-w-0 flex-col gap-3">
                <h2 className="text-lg font-black text-zinc-950 dark:text-zinc-50">そのまま使える型</h2>
                {analysis.patterns.map((pattern, index) => (
                  <PatternCard key={index} pattern={pattern} language={language} speechLang={speechLang} />
                ))}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PhraseSummary({
  analysis,
  language,
  speechLang,
}: {
  analysis: PhraseAnalysis;
  language: TargetLanguage;
  speechLang: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-zinc-400 dark:text-zinc-500">元の文</p>
        <SpeakButton text={analysis.normalizedText} lang={speechLang} label="音声" preload />
      </div>
      <p className="mt-2 break-words text-2xl font-black leading-relaxed text-zinc-950 dark:text-zinc-50">
        {analysis.normalizedText}
      </p>
      {(language === "zh" || language === "hi") && analysis.reading ? (
        <p className="mt-2 break-words text-sm font-black bn-text-good">{analysis.reading}</p>
      ) : null}
      <p className="mt-3 break-words rounded-lg bg-zinc-50 p-3 text-base font-black text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
        {analysis.translation}
      </p>
      {language === "es" && analysis.english ? (
        <p className="mt-2 break-words rounded-lg bg-sky-50 p-3 text-base font-bold text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          {analysis.english}
        </p>
      ) : null}
      {analysis.literal ? (
        <p className="mt-2 ml-1 border-l-2 border-zinc-300 pl-3 text-sm font-bold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          直訳：{analysis.literal}
        </p>
      ) : null}
      {analysis.register ? (
        <span className="mt-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          {analysis.register}
        </span>
      ) : null}
    </section>
  );
}

function WordCards({
  analysis,
  statuses,
  language,
}: {
  analysis: PhraseAnalysis;
  statuses: Record<string, PhraseWordStatus>;
  language: TargetLanguage;
}) {
  if (analysis.words.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-black text-zinc-950 dark:text-zinc-50">単語解説</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {analysis.words.map((word, index) => {
          const status = statuses[normalizeWordSurface(language, word.surface)] ?? "new";
          return (
            <WordCard
              key={`${word.surface}-${index}`}
              surface={word.surface}
              reading={word.reading}
              meaning={word.meaning}
              pos={word.pos}
              note={word.note}
              status={toWordCardStatus(status)}
              language={language}
            />
          );
        })}
      </div>
    </section>
  );
}

function PatternCard({
  pattern,
  language,
  speechLang,
}: {
  pattern: PhrasePattern;
  language: TargetLanguage;
  speechLang: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        {pattern.template ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-black uppercase tracking-wide bn-text-good">型</p>
            <p className="mt-2 break-words text-2xl font-black leading-relaxed text-zinc-950 dark:text-zinc-50">
              {pattern.template}
            </p>
            {(language === "zh" || language === "hi") && pattern.templateReading ? (
              <p className="mt-2 break-words text-sm font-black bn-text-good">{pattern.templateReading}</p>
            ) : null}
          </div>
        ) : null}
        {pattern.meaning ? (
          <div className="rounded-lg border p-4 bn-semantic-warn">
            <p className="text-xs font-black uppercase tracking-wide">意味</p>
            <p className="mt-2 text-base font-bold leading-relaxed">{pattern.meaning}</p>
          </div>
        ) : null}
      </div>

      {pattern.swaps.length > 0 ? (
        <section className="mt-4 rounded-lg border border-sky-100 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/40">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-black text-zinc-950 dark:text-zinc-50">入れ替え</h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-sky-700 dark:bg-zinc-900 dark:text-sky-200">
              {pattern.swaps.length}パターン
            </span>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {pattern.swaps.map((swap, index) => (
              <article key={`${swap.term}-${index}`} className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-950">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-xl font-black text-zinc-950 dark:text-zinc-50">{swap.term}</p>
                  {swap.meaning ? (
                    <p className="text-sm font-bold text-sky-700 dark:text-sky-300">{swap.meaning}</p>
                  ) : null}
                </div>
                {swap.example ? (
                  <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-base font-black leading-relaxed text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    {swap.example}
                  </p>
                ) : null}
                {(language === "zh" || language === "hi") && swap.exampleReading ? (
                  <p className="mt-1 text-sm font-bold leading-relaxed bn-text-good">{swap.exampleReading}</p>
                ) : null}
                {language === "es" && swap.exampleEnglish ? (
                  <p className="mt-1 text-sm font-bold leading-relaxed text-sky-700 dark:text-sky-300">
                    {swap.exampleEnglish}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {pattern.examples.length > 0 ? (
        <section className="mt-4 rounded-lg border p-4 bn-semantic-good">
          <h3 className="text-base font-black">自分で言うなら</h3>
          <div className="mt-3 grid gap-2">
            {pattern.examples.map((example, index) => (
              <div key={`${example.text}-${index}`} className="rounded-lg bg-white p-3 shadow-sm dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-black leading-relaxed text-zinc-900 dark:text-zinc-50">
                    {example.text}
                  </p>
                  <SpeakButton text={example.text} lang={speechLang} label="音声" />
                </div>
                {(language === "zh" || language === "hi") && example.reading ? (
                  <p className="mt-1 text-sm font-bold leading-relaxed bn-text-good">{example.reading}</p>
                ) : null}
                {example.translation ? (
                  <p className="mt-1 text-sm font-bold leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {example.translation}
                  </p>
                ) : null}
                {language === "es" && example.english ? (
                  <p className="mt-1 text-sm font-bold leading-relaxed text-sky-700 dark:text-sky-300">
                    {example.english}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {pattern.note ? (
        <section className="mt-4 rounded-lg border p-4 bn-semantic-bad">
          <h3 className="text-base font-black">注意</h3>
          <p className="mt-2 text-sm font-bold leading-relaxed">{pattern.note}</p>
        </section>
      ) : null}
    </div>
  );
}
