"use client";

import { useMemo, useState } from "react";
import { curriculum } from "@/data/curriculum";
import { LANGUAGE_LABELS, TARGET_LANGUAGES } from "@/lib/languages";
import { loadMastery, type MasteryRecord } from "@/lib/masteryStore";
import { loadWords, type WordRecord } from "@/lib/wordStore";
import type { Level, TargetLanguage } from "@/types/question";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

type Tab = "words" | "grammar";
type LanguageFilter = "all" | TargetLanguage;
type LevelFilter = "all" | Level;
type PosFilter = "all" | string;

interface StudyStatusViewProps {
  initialLanguage?: TargetLanguage | null;
  onClose: () => void;
}

function formatDate(iso: string): string {
  if (!iso) return "未記録";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "未記録";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function percent(correct: number, attempts: number): string {
  if (attempts === 0) return "-";
  return `${Math.round((correct / attempts) * 100)}%`;
}

function getMasteryLabel(record?: MasteryRecord): {
  label: string;
  className: string;
} {
  if (!record || record.attempts === 0) {
    return { label: "未着手", className: "bg-zinc-100 text-zinc-500" };
  }
  const rate = record.correct / record.attempts;
  if (rate < 0.6) return { label: "復習", className: "bg-amber-100 text-amber-700" };
  if (rate < 0.85) return { label: "練習中", className: "bg-sky-100 text-sky-700" };
  return { label: "安定", className: "bg-emerald-100 text-emerald-700" };
}

function wordReadingLabel(lang: TargetLanguage): string {
  return lang === "es" ? "英語の意味" : "読み";
}

export default function StudyStatusView({ initialLanguage, onClose }: StudyStatusViewProps) {
  const [words] = useState<WordRecord[]>(() => loadWords());
  const [mastery] = useState<Record<string, MasteryRecord>>(() => loadMastery());
  const [activeTab, setActiveTab] = useState<Tab>("words");
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>(initialLanguage ?? "all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [posFilter, setPosFilter] = useState<PosFilter>("all");
  const [query, setQuery] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredWords = useMemo(() => {
    return words
      .filter((word) => languageFilter === "all" || word.lang === languageFilter)
      .filter((word) => posFilter === "all" || word.pos === posFilter)
      .filter((word) => !reviewOnly || !word.remembered)
      .filter((word) => {
        if (!normalizedQuery) return true;
        return [word.surface, word.reading, word.meaning, word.pos]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (a.remembered !== b.remembered) return a.remembered ? 1 : -1;
        return b.lastSeen.localeCompare(a.lastSeen);
      });
  }, [languageFilter, normalizedQuery, posFilter, reviewOnly, words]);

  const posOptions = useMemo(() => {
    return Array.from(
      new Set(
        words
          .filter((word) => languageFilter === "all" || word.lang === languageFilter)
          .map((word) => word.pos)
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "ja"));
  }, [languageFilter, words]);

  const grammarRows = useMemo(() => {
    return curriculum
      .filter((item) => languageFilter === "all" || item.language === languageFilter)
      .filter((item) => levelFilter === "all" || item.level === levelFilter)
      .filter((item) => {
        if (!normalizedQuery) return true;
        return [item.name, item.pattern, item.summary, item.exampleJa, item.exampleTarget]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .map((item) => ({ item, record: mastery[item.id] }))
      .sort((a, b) => {
        const aAttempts = a.record?.attempts ?? 0;
        const bAttempts = b.record?.attempts ?? 0;
        const aWeak = aAttempts > 0 && (a.record?.correct ?? 0) / aAttempts < 0.6;
        const bWeak = bAttempts > 0 && (b.record?.correct ?? 0) / bAttempts < 0.6;
        if (aWeak !== bWeak) return aWeak ? -1 : 1;
        return (b.record?.lastSeen ?? "").localeCompare(a.record?.lastSeen ?? "");
      });
  }, [languageFilter, levelFilter, mastery, normalizedQuery]);

  const stats = useMemo(() => {
    const wordsInScope = words.filter((word) => languageFilter === "all" || word.lang === languageFilter);
    const grammarInScope = curriculum.filter(
      (item) =>
        (languageFilter === "all" || item.language === languageFilter) &&
        (levelFilter === "all" || item.level === levelFilter),
    );
    const attempted = grammarInScope.filter((item) => (mastery[item.id]?.attempts ?? 0) > 0);
    const weak = attempted.filter((item) => {
      const record = mastery[item.id];
      return record ? record.correct / record.attempts < 0.6 : false;
    });

    return {
      learnedWords: wordsInScope.length,
      reviewWords: wordsInScope.filter((word) => !word.remembered).length,
      attemptedGrammar: attempted.length,
      weakGrammar: weak.length,
      totalGrammar: grammarInScope.length,
    };
  }, [languageFilter, levelFilter, mastery, words]);

  return (
    <div className="min-h-full bg-[#fbfaf6]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">学習状況</h1>
            <p className="text-xs font-bold text-zinc-500">単語と文法の記録を一覧できます</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 w-fit rounded-lg px-3 text-sm font-black text-zinc-500 transition-colors hover:bg-white hover:text-emerald-700"
          >
            学習に戻る
          </button>
        </header>

        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs font-bold text-zinc-400">学習単語</p>
            <p className="mt-1 text-2xl font-black text-zinc-900">{stats.learnedWords}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs font-bold text-zinc-400">復習単語</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{stats.reviewWords}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs font-bold text-zinc-400">文法の進捗</p>
            <p className="mt-1 text-2xl font-black text-zinc-900">
              {stats.attemptedGrammar}
              <span className="text-sm font-semibold text-zinc-400">/{stats.totalGrammar}</span>
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs font-bold text-zinc-400">弱点文法</p>
            <p className="mt-1 text-2xl font-black text-rose-700">{stats.weakGrammar}</p>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-200 p-1 sm:w-72">
              {[
                { value: "words", label: "単語" },
                { value: "grammar", label: "文法" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={activeTab === tab.value}
                  onClick={() => setActiveTab(tab.value as Tab)}
                  className={`min-h-10 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === tab.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="検索"
              className="min-h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "すべて" },
                ...TARGET_LANGUAGES.map((lang) => ({ value: lang, label: LANGUAGE_LABELS[lang] })),
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={languageFilter === option.value}
                  onClick={() => setLanguageFilter(option.value as LanguageFilter)}
                  className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${
                    languageFilter === option.value
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {activeTab === "grammar" ? (
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "全レベル" },
                  ...LEVELS.map((lvl) => ({ value: lvl, label: lvl })),
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={levelFilter === option.value}
                    onClick={() => setLevelFilter(option.value as LevelFilter)}
                    className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${
                      levelFilter === option.value
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-h-9 w-fit items-center gap-2 text-sm font-medium text-zinc-600">
                  <input
                    type="checkbox"
                    checked={reviewOnly}
                    onChange={(event) => setReviewOnly(event.target.checked)}
                    className="size-4 accent-zinc-900"
                  />
                  復習単語のみ
                </label>
                <select
                  value={posFilter}
                  onChange={(event) => setPosFilter(event.target.value)}
                  className="min-h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 outline-none focus:border-emerald-500"
                >
                  <option value="all">すべての品詞</option>
                  {posOptions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {activeTab === "words" ? (
          <section className="grid gap-3 md:grid-cols-2">
            {filteredWords.length > 0 ? (
              filteredWords.map((word) => (
                <article
                  key={word.key}
                  className="flex min-h-44 flex-col justify-between rounded-lg border border-zinc-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-zinc-400">{LANGUAGE_LABELS[word.lang]}</p>
                      <h2 className="mt-1 break-words text-2xl font-bold text-zinc-900">{word.surface}</h2>
                      {word.reading ? (
                        <p className="mt-1 break-words text-sm text-zinc-500">
                          {wordReadingLabel(word.lang)}: {word.reading}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        word.remembered ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {word.remembered ? "記憶済み" : "復習"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 text-sm text-zinc-600">
                    {word.meaning ? <p className="break-words font-medium text-zinc-800">{word.meaning}</p> : null}
                    {word.pos ? <p>品詞: {word.pos}</p> : null}
                    <p>
                      正答率 {percent(word.correctCount, word.seenCount)}・出現 {word.seenCount}回・最終{" "}
                      {formatDate(word.lastSeen)}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 md:col-span-2">
                表示できる単語がまだありません。
              </div>
            )}
          </section>
        ) : (
          <section className="grid gap-3">
            {grammarRows.length > 0 ? (
              grammarRows.map(({ item, record }) => {
                const masteryLabel = getMasteryLabel(record);
                return (
                  <article key={item.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">
                            {LANGUAGE_LABELS[item.language]}・{item.level}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${masteryLabel.className}`}>
                            {masteryLabel.label}
                          </span>
                        </div>
                        <h2 className="mt-3 text-lg font-bold text-zinc-900">{item.name}</h2>
                        <p className="mt-1 break-words text-sm font-medium text-zinc-600">{item.pattern}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center sm:min-w-56">
                        <div className="rounded-lg bg-zinc-50 px-2 py-2">
                          <p className="text-xs text-zinc-400">正答率</p>
                          <p className="text-sm font-bold text-zinc-900">
                            {percent(record?.correct ?? 0, record?.attempts ?? 0)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-zinc-50 px-2 py-2">
                          <p className="text-xs text-zinc-400">正解</p>
                          <p className="text-sm font-bold text-zinc-900">{record?.correct ?? 0}</p>
                        </div>
                        <div className="rounded-lg bg-zinc-50 px-2 py-2">
                          <p className="text-xs text-zinc-400">回数</p>
                          <p className="text-sm font-bold text-zinc-900">{record?.attempts ?? 0}</p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-600">{item.summary}</p>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <p className="rounded-lg bg-zinc-50 p-3 text-zinc-600">
                        <span className="font-semibold text-zinc-900">日本語: </span>
                        {item.exampleJa}
                      </p>
                      <p className="rounded-lg bg-zinc-50 p-3 text-zinc-600">
                        <span className="font-semibold text-zinc-900">例文: </span>
                        {item.exampleTarget}
                      </p>
                    </div>
                    <p className="mt-3 text-xs text-zinc-400">最終: {formatDate(record?.lastSeen ?? "")}</p>
                  </article>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
                表示できる文法項目がありません。
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
