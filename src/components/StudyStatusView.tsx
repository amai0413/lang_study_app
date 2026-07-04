"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { curriculum } from "@/data/curriculum";
import { formatDate, percent } from "@/lib/format";
import { LANGUAGE_LABELS, TARGET_LANGUAGES } from "@/lib/languages";
import { loadMastery, type MasteryRecord } from "@/lib/masteryStore";
import { getLearningProgress } from "@/lib/progress";
import { backfillWordAudio } from "@/lib/audioBackfill";
import { loadWords, type WordRecord } from "@/lib/wordStore";
import type { Level, TargetLanguage } from "@/types/question";
import ProgressMeter from "@/components/ProgressMeter";
import WordCard from "@/components/WordCard";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

type Tab = "words" | "grammar";
type LanguageFilter = "all" | TargetLanguage;
type LevelFilter = "all" | Level;
type PosFilter = "all" | string;
type BackfillStatus = "idle" | "generating" | "done" | "failed";

interface StudyStatusViewProps {
  initialLanguage?: TargetLanguage | null;
  onClose: () => void;
  themeToggle?: ReactNode;
}

function getMasteryStyle(record?: MasteryRecord): {
  label: string;
  cardClassName: string;
  badgeClassName: string;
} {
  if (!record || record.attempts === 0) {
    return {
      label: "未着手",
      cardClassName:
        "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50",
      badgeClassName: "bn-semantic-badge text-zinc-500 dark:text-zinc-400",
    };
  }
  const rate = record.correct / record.attempts;
  // 文法カード全体を状態色で塗る。安定した項目は文法の進捗と同じ青にする。
  if (rate < 0.6) {
    return { label: "弱点", cardClassName: "bn-semantic-bad-strong", badgeClassName: "bn-semantic-badge bn-text-bad" };
  }
  if (rate < 0.85) {
    return {
      label: "復習",
      cardClassName: "bn-semantic-warn-strong",
      badgeClassName: "bn-semantic-badge bn-text-warn",
    };
  }
  return {
    label: "安定",
    cardClassName: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-100",
    badgeClassName: "bg-white/70 text-sky-700 dark:bg-zinc-950/25 dark:text-sky-100",
  };
}

export default function StudyStatusView({ initialLanguage, onClose, themeToggle }: StudyStatusViewProps) {
  const [words, setWords] = useState<WordRecord[]>(() => loadWords());
  const [mastery] = useState<Record<string, MasteryRecord>>(() => loadMastery());
  const [activeTab, setActiveTab] = useState<Tab>("words");
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>(initialLanguage ?? "all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [posFilter, setPosFilter] = useState<PosFilter>("all");
  const [query, setQuery] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<BackfillStatus>("idle");
  const [backfillMessage, setBackfillMessage] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  // 練習の記録（正解・正答率・回答数）は学習状況にだけ表示する。特定言語を選んだときのみ。
  const languageProgress = useMemo(
    () => (languageFilter === "all" ? null : getLearningProgress(languageFilter)),
    [languageFilter],
  );

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

  const missingAudioWords = useMemo(
    () => filteredWords.filter((word) => !word.audio?.audioUrl && word.audioStatus !== "ready"),
    [filteredWords],
  );
  const generatedAudioCount = filteredWords.length - missingAudioWords.length;

  const handleBackfillAudio = async () => {
    const batch = missingAudioWords.slice(0, 30);
    if (batch.length === 0 || backfillStatus === "generating") return;

    setBackfillStatus("generating");
    setBackfillMessage(`${batch.length}件の単語音声を生成しています。`);

    try {
      const result = await backfillWordAudio(
        batch.map((word) => ({
          lang: word.lang,
          surface: word.surface,
          existingAudioUrl: word.audio?.audioUrl ?? null,
        })),
      );
      if (result.words) setWords(result.words);
      setBackfillStatus(result.failed > 0 ? "failed" : "done");
      setBackfillMessage(result.message);
    } catch (error) {
      setBackfillStatus("failed");
      setBackfillMessage(error instanceof Error ? error.message : "単語音声の一括生成に失敗しました。");
    }
  };

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
    <div className="min-h-full bg-[#fbfaf6] dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-screen-2xl min-w-0 flex-col gap-5 p-3 sm:p-4 lg:p-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-950 dark:text-zinc-50">学習状況</h1>
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">単語と文法の記録を一覧できます</p>
          </div>
          <div className="flex items-center gap-2">
            {themeToggle}
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 w-fit rounded-lg px-3 text-sm font-black text-zinc-500 transition-colors hover:bg-white hover:text-[var(--bn-good-text)] dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              学習に戻る
            </button>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4 shadow-sm bn-semantic-good">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black tracking-wide opacity-75">学習単語</p>
              <span className="rounded-full px-2.5 py-1 text-xs font-black bn-semantic-badge">ALL</span>
            </div>
            <p className="mt-3 text-3xl font-black leading-none">{stats.learnedWords}</p>
            <div className="mt-4 h-1.5 rounded-full bg-[var(--bn-good-bg-strong)]">
              <div className="h-full w-full rounded-full bg-[var(--bn-good-solid)]" />
            </div>
          </div>
          <div className="rounded-lg border p-4 shadow-sm bn-semantic-warn">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black tracking-wide opacity-75">復習単語</p>
              <span className="rounded-full px-2.5 py-1 text-xs font-black bn-semantic-badge">REVIEW</span>
            </div>
            <p className="mt-3 text-3xl font-black leading-none">{stats.reviewWords}</p>
            <div className="mt-4 h-1.5 rounded-full bg-[var(--bn-warn-bg-strong)]">
              <div
                className="h-full rounded-full bg-[var(--bn-warn-solid)]"
                style={{ width: `${stats.learnedWords ? Math.max(8, Math.round((stats.reviewWords / stats.learnedWords) * 100)) : 0}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-900 shadow-sm dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-100">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black tracking-wide opacity-75">文法の進捗</p>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-black text-sky-700 dark:bg-zinc-950/25 dark:text-sky-100">
                {stats.totalGrammar}
              </span>
            </div>
            <p className="mt-3 text-3xl font-black leading-none">
              {stats.attemptedGrammar}
              <span className="ml-1 text-sm font-semibold opacity-65">/{stats.totalGrammar}</span>
            </p>
            <div className="mt-4 h-1.5 rounded-full bg-sky-100 dark:bg-sky-900">
              <div
                className="h-full rounded-full bg-sky-500 dark:bg-sky-400"
                style={{ width: `${stats.totalGrammar ? Math.round((stats.attemptedGrammar / stats.totalGrammar) * 100) : 0}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg border p-4 shadow-sm bn-semantic-bad">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black tracking-wide opacity-75">弱点文法</p>
              <span className="rounded-full px-2.5 py-1 text-xs font-black bn-semantic-badge">CHECK</span>
            </div>
            <p className="mt-3 text-3xl font-black leading-none">{stats.weakGrammar}</p>
            <p className="mt-3 text-xs font-bold opacity-75">正答率が低い項目</p>
          </div>
        </div>

        {languageProgress ? <ProgressMeter progress={languageProgress} /> : null}

        <section className="flex flex-col gap-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900 sm:w-72">
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
                    activeTab === tab.value
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-50 dark:text-zinc-950"
                      : "text-zinc-500 dark:text-zinc-400"
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
              className="min-h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[var(--bn-good-border)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
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
                        ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-h-9 w-fit items-center gap-2 rounded-lg bg-zinc-50 px-3 text-sm font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
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
                    className="min-h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 outline-none focus:border-[var(--bn-good-border)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  >
                    <option value="all">すべての品詞</option>
                    {posOptions.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-zinc-500 dark:text-zinc-400">単語音声</p>
                      <p className="mt-1 text-xs font-bold text-zinc-400">
                        対象 {filteredWords.length}・音声あり {generatedAudioCount}・未生成 {missingAudioWords.length}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBackfillAudio}
                      disabled={missingAudioWords.length === 0 || backfillStatus === "generating"}
                      className="min-h-9 rounded-lg bg-zinc-950 px-3 text-xs font-black text-white transition-colors hover:bg-[var(--bn-good-solid)] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-zinc-50 dark:text-zinc-950 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                    >
                      {backfillStatus === "generating" ? "生成中" : "未生成音声を一括生成"}
                    </button>
                  </div>
                  {backfillMessage ? (
                    <p className="mt-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">{backfillMessage}</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>

        {activeTab === "words" ? (
          <section className="grid gap-3 md:grid-cols-2">
            {filteredWords.length > 0 ? (
              filteredWords.map((word) => (
                <WordCard
                  key={word.key}
                  surface={word.surface}
                  reading={word.reading}
                  meaning={word.meaning}
                  pos={word.pos}
                  status={word.remembered ? "remembered" : "review"}
                  language={word.lang}
                />
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 md:col-span-2">
                表示できる単語がまだありません。
              </div>
            )}
          </section>
        ) : (
          <section className="grid gap-3 lg:grid-cols-2">
            {grammarRows.length > 0 ? (
              grammarRows.map(({ item, record }) => {
                const masteryStyle = getMasteryStyle(record);
                return (
                  <article
                    key={item.id}
                    className={`rounded-lg border p-4 shadow-sm ${masteryStyle.cardClassName}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/45 px-2.5 py-1 text-xs font-black opacity-80 dark:bg-zinc-950/20">
                            {LANGUAGE_LABELS[item.language]}・{item.level}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${masteryStyle.badgeClassName}`}>
                            {masteryStyle.label}
                          </span>
                        </div>
                        <h2 className="mt-3 text-lg font-black">{item.name}</h2>
                        <p className="mt-1 break-words text-sm font-bold opacity-75">{item.pattern}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center sm:min-w-56">
                        <div className="rounded-lg bg-white/45 px-2 py-2 dark:bg-zinc-950/20">
                          <p className="text-xs opacity-70">正答率</p>
                          <p className="text-sm font-black">
                            {percent(record?.correct ?? 0, record?.attempts ?? 0)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/45 px-2 py-2 dark:bg-zinc-950/20">
                          <p className="text-xs opacity-70">正解</p>
                          <p className="text-sm font-black">{record?.correct ?? 0}</p>
                        </div>
                        <div className="rounded-lg bg-white/45 px-2 py-2 dark:bg-zinc-950/20">
                          <p className="text-xs opacity-70">回数</p>
                          <p className="text-sm font-black">{record?.attempts ?? 0}</p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-bold leading-relaxed opacity-85">{item.summary}</p>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <p className="rounded-lg bg-white/85 p-3 text-zinc-900 shadow-sm dark:bg-zinc-950/25 dark:text-zinc-50">
                        <span className="font-black">日本語: </span>
                        {item.exampleJa}
                      </p>
                      <p className="rounded-lg bg-white/85 p-3 text-zinc-900 shadow-sm dark:bg-zinc-950/25 dark:text-zinc-50">
                        <span className="font-black">例文: </span>
                        {item.exampleTarget}
                      </p>
                    </div>
                    <p className="mt-3 text-xs opacity-70">最終: {formatDate(record?.lastSeen ?? "")}</p>
                  </article>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 lg:col-span-2">
                表示できる文法項目がありません。
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
