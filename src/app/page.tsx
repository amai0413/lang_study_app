"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Question, TargetLanguage, Level } from "@/types/question";
import { backfillMissingWordAudio } from "@/lib/audioBackfill";
import { fetchGrade, type GradeResult } from "@/lib/grade";
import { appendHistory, loadHistory } from "@/lib/storage";
import { selectTarget, type QuizTarget } from "@/lib/selectTarget";
import { recordMasteryAttempt } from "@/lib/masteryStore";
import { recordWords, getWordStats } from "@/lib/wordStore";
import { LANGUAGE_LABELS, TARGET_LANGUAGES } from "@/lib/languages";
import { getLearningProgress, type LearningProgress } from "@/lib/progress";
import QuestionCard from "@/components/QuestionCard";
import AnswerInput from "@/components/AnswerInput";
import ResultPanel from "@/components/ResultPanel";
import ExplanationPanel from "@/components/ExplanationPanel";
import { LevelRing } from "@/components/ProgressMeter";
import StudyStatusView from "@/components/StudyStatusView";
import AnswerTimer from "@/components/AnswerTimer";
import AssessmentPanel from "@/components/AssessmentPanel";
import WordPracticeView from "@/components/WordPracticeView";
import PhraseRegisterView from "@/components/PhraseRegisterView";

type PracticeMode = "grammar" | "vocab" | "phrase";
type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "bn-theme";

// テーマは localStorage/OS設定という「外部ストア」の値なので useSyncExternalStore で読む。
// サーバーは常に "light" を返す（getServerSnapshot）ため、ハイドレーション時の
// 初回クライアント描画もサーバーと一致し、ミスマッチによる全体再描画が起きない。
let cachedThemeMode: ThemeMode | null = null;
const themeListeners = new Set<() => void>();

function resolveThemeMode(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getThemeSnapshot(): ThemeMode {
  if (cachedThemeMode === null) cachedThemeMode = resolveThemeMode();
  return cachedThemeMode;
}

function getThemeServerSnapshot(): ThemeMode {
  return "light";
}

function subscribeThemeMode(onChange: () => void): () => void {
  themeListeners.add(onChange);
  return () => themeListeners.delete(onChange);
}

function setThemeMode(next: ThemeMode): void {
  cachedThemeMode = next;
  window.localStorage.setItem(THEME_STORAGE_KEY, next);
  themeListeners.forEach((listener) => listener());
}

const HOME_LANG_META: Record<TargetLanguage, { flag: string; motif: string; tone: string }> = {
  zh: { flag: "🇹🇼", motif: "茶館・夜市・繁体字", tone: "from-rose-50 to-amber-50" },
  hi: { flag: "🇮🇳", motif: "市場・チャイ・デーヴァナーガリー", tone: "from-orange-50 to-emerald-50" },
  es: { flag: "🇪🇸", motif: "広場・カフェ・会話", tone: "from-yellow-50 to-red-50" },
};

async function fetchQuestion(
  lang: TargetLanguage,
  level: Level,
  target: QuizTarget,
): Promise<Question> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetLanguage: lang,
      level,
      grammar: {
        name: target.item.name,
        pattern: target.item.pattern,
        summary: target.item.summary,
      },
      reviewWord: target.reviewWord
        ? { surface: target.reviewWord.surface, meaning: target.reviewWord.meaning }
        : undefined,
    }),
  });
  const data: { question?: Omit<Question, "id" | "level" | "targetLanguage">; error?: string } =
    await res.json();
  if (!res.ok || !data.question) throw new Error(data.error ?? "問題の生成に失敗しました。");
  return {
    id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    level,
    targetLanguage: lang,
    grammarItemId: target.item.id,
    ...data.question,
  };
}

export default function Home() {
  const themeMode = useSyncExternalStore(subscribeThemeMode, getThemeSnapshot, getThemeServerSnapshot);
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage | null>(null);
  const [practiceMode, setPracticeMode] = useState<PracticeMode | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [isReview, setIsReview] = useState(false);
  const [reviewWord, setReviewWord] = useState<string | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [showStudyStatus, setShowStudyStatus] = useState(false);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [wordStats, setWordStats] = useState<{ learned: number; review: number }>({
    learned: 0,
    review: 0,
  });
  const isDarkMode = themeMode === "dark";

  useEffect(() => {
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode(themeMode === "dark" ? "light" : "dark");
  };

  const themeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      className="min-h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-600 shadow-sm transition-colors hover:border-[var(--bn-good-border)] hover:bg-[var(--bn-good-bg)] hover:text-[var(--bn-good-text)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      aria-label="テーマを切り替える"
    >
      {isDarkMode ? "ライト" : "ダーク"}
    </button>
  );

  const startQuestion = async (lang: TargetLanguage) => {
    const nextProgress = getLearningProgress(lang);
    const lvl = nextProgress.level;
    setProgress(nextProgress);
    setIsGenerating(true);
    setGenerateError(null);
    setGradeError(null);
    setCurrentQuestion(null);
    setGradeResult(null);
    setUserInput("");
    setTimeExpired(false);
    setWordStats(getWordStats(lang));
    // カリキュラム＋習得度から出題対象を選ぶ（弱点/忘れた単語を復習に混ぜる）
    const target = selectTarget(lang, lvl);
    setIsReview(target.isReview);
    setReviewWord(target.reviewWord?.surface ?? null);
    try {
      const question = await fetchQuestion(lang, lvl, target);
      setCurrentQuestion(question);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "問題の生成に失敗しました。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectLanguage = (lang: TargetLanguage) => {
    setTargetLanguage(lang);
    setPracticeMode("grammar");
    startQuestion(lang);
  };

  const handleSelectWordPractice = (lang: TargetLanguage) => {
    setTargetLanguage(lang);
    setPracticeMode("vocab");
    setCurrentQuestion(null);
    setGradeResult(null);
    setUserInput("");
    setGenerateError(null);
    setGradeError(null);
    setProgress(getLearningProgress(lang));
    setWordStats(getWordStats(lang));
  };

  const handleSelectPhraseRegister = (lang: TargetLanguage) => {
    setTargetLanguage(lang);
    setPracticeMode("phrase");
    setCurrentQuestion(null);
    setGradeResult(null);
    setUserInput("");
    setGenerateError(null);
    setGradeError(null);
    setProgress(getLearningProgress(lang));
    setWordStats(getWordStats(lang));
  };

  const handleJudge = useCallback(async (answerOverride?: string) => {
    if (!currentQuestion || isGrading || gradeResult) return;
    const submittedAnswer = (answerOverride ?? userInput).trim();
    if (submittedAnswer.length === 0) return;
    setIsGrading(true);
    setGradeError(null);
    if (submittedAnswer !== userInput) setUserInput(submittedAnswer);
    try {
      const result = await fetchGrade(currentQuestion, submittedAnswer);
      setGradeResult(result);

      const wasCorrect = result.status === "correct" || result.status === "acceptable";

      // 履歴に保存（acceptable は correct 扱い）
      const history = loadHistory();
      appendHistory(history, {
        questionId: currentQuestion.id,
        targetLanguage: currentQuestion.targetLanguage,
        userInput: submittedAnswer,
        result: result.status === "acceptable" ? "correct" : result.status,
        timestamp: new Date().toISOString(),
      });

      // 文法習得度を記録
      if (currentQuestion.grammarItemId) {
        recordMasteryAttempt(currentQuestion.grammarItemId, wasCorrect);
      }
      // 単語DBに、使われた単語＋覚えていたかを記録
      if (result.words?.length) {
        recordWords(currentQuestion.targetLanguage, result.words, wasCorrect);
        // 音声が未生成の単語は裏で自動生成する（失敗してもUIは止めない）
        backfillMissingWordAudio(
          currentQuestion.targetLanguage,
          result.words.map((word) => word.surface),
        );
      }
      setWordStats(getWordStats(currentQuestion.targetLanguage));
      setProgress(getLearningProgress(currentQuestion.targetLanguage));
    } catch (err) {
      setGradeError(err instanceof Error ? err.message : "採点に失敗しました。");
    } finally {
      setIsGrading(false);
    }
  }, [currentQuestion, gradeResult, isGrading, userInput]);

  const handleTimerExpire = useCallback(() => {
    setTimeExpired(true);
    void handleJudge(userInput.trim() || "（時間切れ・無回答）");
  }, [handleJudge, userInput]);

  const handleNext = () => {
    if (targetLanguage) startQuestion(targetLanguage);
  };

  const handleChangeLanguage = () => {
    setTargetLanguage(null);
    setPracticeMode(null);
    setCurrentQuestion(null);
    setGradeResult(null);
    setUserInput("");
    setGenerateError(null);
    setGradeError(null);
    setReviewWord(null);
    setTimeExpired(false);
    setProgress(null);
    setIsGenerating(false);
    setIsGrading(false);
  };

  const handleCloseStudyStatus = () => {
    setShowStudyStatus(false);
    if (!targetLanguage) return;
    setWordStats(getWordStats(targetLanguage));
    setProgress(getLearningProgress(targetLanguage));
  };

  if (showStudyStatus) {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <StudyStatusView
          initialLanguage={targetLanguage}
          onClose={handleCloseStudyStatus}
          themeToggle={themeToggle}
        />
      </div>
    );
  }

  if (targetLanguage && practiceMode === "vocab") {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <WordPracticeView
          language={targetLanguage}
          onBack={handleChangeLanguage}
          themeToggle={themeToggle}
          onStatsChange={() => {
            setWordStats(getWordStats(targetLanguage));
            setProgress(getLearningProgress(targetLanguage));
          }}
        />
      </div>
    );
  }

  if (targetLanguage && practiceMode === "phrase") {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <PhraseRegisterView
          language={targetLanguage}
          onBack={handleChangeLanguage}
          themeToggle={themeToggle}
          onStatsChange={() => {
            setWordStats(getWordStats(targetLanguage));
            setProgress(getLearningProgress(targetLanguage));
          }}
        />
      </div>
    );
  }

  // ── 言語選択画面 ──
  if (!targetLanguage) {
    return (
      <div className={`${isDarkMode ? "dark" : ""} min-h-full bg-[#fff7ed] px-5 py-8 dark:bg-zinc-950`}>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8">
          <div className="flex w-full justify-end">{themeToggle}</div>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-white px-4 py-1.5 text-xs font-black bn-text-good shadow-sm dark:bg-zinc-900">
              A1 から自動スタート
            </div>
            <h1 className="text-5xl font-black text-zinc-950 dark:text-zinc-50 sm:text-7xl">Become Native!</h1>
            <p className="max-w-2xl text-base font-bold leading-relaxed text-zinc-600 dark:text-zinc-300">
              ネイティブ話者にも自然に通じる会話を、即答力まで鍛える練習アプリです。
            </p>
          </div>
          <div className="grid w-full gap-4 lg:grid-cols-3">
            {TARGET_LANGUAGES.map((lang) => {
              const meta = HOME_LANG_META[lang];
              return (
                <article
                  key={lang}
                  className={`overflow-hidden rounded-lg border border-white/80 bg-gradient-to-br ${meta.tone} p-4 shadow-sm dark:border-zinc-800 dark:bg-none dark:bg-zinc-900`}
                >
                  <div className="flex min-h-44 flex-col justify-between rounded-lg bg-white/70 p-4 dark:bg-zinc-950/70">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-5xl">{meta.flag}</span>
                      </div>
                      <h2 className="mt-5 text-3xl font-black text-zinc-950 dark:text-zinc-50">{LANGUAGE_LABELS[lang]}</h2>
                    </div>
                    <div className="mt-5 grid gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectLanguage(lang)}
                        className="min-h-11 rounded-lg bg-zinc-950 text-sm font-black text-white transition-colors hover:bg-[var(--bn-good-solid)]"
                      >
                        会話練習
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectWordPractice(lang)}
                        className="min-h-11 rounded-lg border border-zinc-200 bg-white text-sm font-black text-zinc-700 transition-colors hover:border-[var(--bn-warn-border)] hover:bg-[var(--bn-warn-bg)] hover:text-[var(--bn-warn-text)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        単語練習
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectPhraseRegister(lang)}
                        className="min-h-11 rounded-lg border border-zinc-200 bg-white text-sm font-black text-zinc-700 transition-colors hover:border-[var(--bn-good-border)] hover:bg-[var(--bn-good-bg)] hover:text-[var(--bn-good-text)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                      >
                        例文登録
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowStudyStatus(true)}
            className="min-h-11 w-full max-w-3xl rounded-lg border border-zinc-200 bg-white text-sm font-black text-zinc-600 transition-colors hover:bg-sky-50 hover:text-sky-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-sky-950 dark:hover:text-sky-300"
          >
            学習状況を見る
          </button>
        </div>
      </div>
    );
  }

  // ── 初回ローディング画面 ──
  if (isGenerating && !currentQuestion) {
    return (
      <div className={`${isDarkMode ? "dark" : ""} min-h-dvh w-full overflow-hidden bg-[#f6f1e7] p-3 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:p-5 lg:p-6`}>
        <div className="mx-auto flex w-full max-w-screen-2xl min-w-0 flex-col justify-start gap-8">
          <header className="bn-fade-up flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] bn-text-good">
                Become Native
              </p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">会話練習</h1>
            </div>
            <div className="flex items-center gap-2">
              {themeToggle}
              <button
                type="button"
                onClick={handleChangeLanguage}
                className="min-h-10 rounded-lg border border-zinc-200 bg-white/70 px-4 text-xs font-black text-zinc-500 shadow-sm transition-colors hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:text-zinc-50"
              >
                ホームへ戻る
              </button>
            </div>
          </header>

          <main className="grid items-start gap-8 lg:grid-cols-[1fr_1.05fr]">
            <div className="bn-fade-up relative flex aspect-square max-h-[430px] w-full items-center justify-center justify-self-center overflow-hidden rounded-lg border border-white/80 bg-[#fffaf0] shadow-sm">
              <div className="absolute inset-8 rounded-full border border-[var(--bn-warn-border)] opacity-80" />
              <div className="bn-spin-soft absolute inset-14 rounded-full border border-dashed border-[var(--bn-good-border)] opacity-90" />
              <div className="absolute h-56 w-56 rounded-full bg-white shadow-sm" />
              <div className="relative grid h-44 w-44 place-items-center rounded-full bg-zinc-950 text-white shadow-xl">
                <span className="text-6xl">{HOME_LANG_META[targetLanguage].flag}</span>
              </div>
              <div className="absolute left-8 top-10 rounded-lg bg-white px-3 py-2 text-sm font-black bn-text-warn shadow-sm">
                {progress?.level ?? "A1"}
              </div>
              <div className="absolute bottom-10 right-8 flex items-end gap-1 rounded-lg px-3 py-2 shadow-sm bn-bg-good-solid">
                {[0, 1, 2, 3].map((bar) => (
                  <span
                    key={bar}
                    className="bn-rise block h-5 w-1.5 rounded-full bg-white"
                    style={{ animationDelay: `${bar * 120}ms` }}
                  />
                ))}
              </div>
            </div>

            <section className="bn-fade-up flex min-w-0 flex-col gap-6" style={{ animationDelay: "120ms" }}>
              <div>
                <p className="text-sm font-black bn-text-good">
                  {LANGUAGE_LABELS[targetLanguage]}・{progress?.level ?? "A1"}
                </p>
                <h2 className="mt-3 max-w-xl text-4xl font-black leading-tight sm:text-5xl">
                  次の会話を準備しています
                </h2>
                <p className="mt-4 max-w-lg text-base font-bold leading-relaxed text-zinc-600">
                  今日の進み具合と復習データから、いま練習する一文を選んでいます。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["文法", "カリキュラム照合", "bn-bg-good-solid"],
                  ["単語", "復習語を確認", "bn-bg-warn-solid"],
                  ["即答", "難度を調整", "bg-sky-500"],
                ].map(([label, detail, color], index) => (
                  <div
                    key={label}
                    className="rounded-lg border border-white/80 bg-white/75 p-4 shadow-sm"
                  >
                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={[
                          "h-full rounded-full",
                          index === 0 ? "w-11/12" : "",
                          index === 1 ? "w-8/12" : "",
                          index === 2 ? "w-7/12" : "",
                          color,
                        ].join(" ")}
                      />
                    </div>
                    <p className="text-sm font-black text-zinc-800">{label}</p>
                    <p className="mt-1 text-xs font-bold text-zinc-400">{detail}</p>
                  </div>
                ))}
              </div>

              <div className="relative h-2 overflow-hidden rounded-full bg-white shadow-inner">
                <div className="h-full w-full rounded-full bg-zinc-950/10" />
                <div className="bn-scan absolute inset-y-0 left-0 w-1/2 rounded-full bg-zinc-950" />
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  // ── 生成エラー画面 ──
  if (generateError && !currentQuestion) {
    return (
      <div className={`${isDarkMode ? "dark" : ""} flex min-h-full flex-col items-center justify-center bg-[#fbfaf6] px-6 dark:bg-zinc-950`}>
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border p-6 text-center shadow-sm bn-semantic-bad">
          <p className="text-base font-black">問題を生成できませんでした</p>
          <p className="text-sm font-semibold">{generateError}</p>
          <button
            type="button"
            onClick={() => startQuestion(targetLanguage)}
            className="min-h-11 rounded-lg bg-zinc-900 px-6 text-sm font-black text-white"
          >
            再試行
          </button>
          <button type="button" onClick={handleChangeLanguage} className="text-sm font-bold text-zinc-400">
            言語選択に戻る
          </button>
        </div>
      </div>
    );
  }

  const isCompactMode = isGrading || Boolean(gradeResult);

  // ── クイズ画面 ──
  return (
    <div className={`${isDarkMode ? "dark" : ""} min-h-dvh w-full bg-[#fbfaf6] dark:bg-zinc-950`}>
      <div className="mx-auto flex w-full max-w-screen-2xl min-w-0 flex-col gap-5 p-3 sm:p-4 lg:p-5">
        <header className="grid gap-3 rounded-lg border border-zinc-200 bg-white/85 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 lg:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.4fr)] lg:items-stretch">
          <div className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <LevelRing progress={progress} compact />
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.2em] bn-text-good">
                    Become Native
                  </p>
                  <h1 className="mt-1 text-2xl font-black text-zinc-950 dark:text-zinc-50">会話練習</h1>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm dark:bg-zinc-900">
                <span className="text-2xl leading-none">{HOME_LANG_META[targetLanguage].flag}</span>
                <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{LANGUAGE_LABELS[targetLanguage]}</span>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-full border px-3 py-1.5 text-sm font-black bn-semantic-good">
                学習単語 {wordStats.learned}
              </span>
              <span className="rounded-full border px-3 py-1.5 text-sm font-black bn-semantic-warn">
                復習 {wordStats.review}
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {themeToggle}
              <button
                type="button"
                onClick={() => setShowStudyStatus(true)}
                className="min-h-10 rounded-lg border px-4 text-xs font-black transition-opacity hover:opacity-90 bn-semantic-good"
              >
                学習状況
              </button>
              <button
                type="button"
                onClick={handleChangeLanguage}
                className="min-h-10 rounded-lg border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
              >
                ホームへ戻る
              </button>
            </div>
          </div>
        </header>

        {currentQuestion ? (
          <div
            className={[
              "transition-all duration-700 ease-out",
              isCompactMode
                ? "flex flex-col gap-4"
                : "mx-auto flex w-full max-w-6xl flex-col gap-4 pt-4 lg:pt-8",
            ].join(" ")}
          >
            <div
              className={
                isCompactMode
                  ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)] lg:items-start"
                  : "contents"
              }
            >
              <section
                className={[
                  "flex min-w-0 flex-col gap-4 transition-all duration-700 ease-out",
                  isCompactMode ? "lg:pt-0" : "lg:gap-5",
                ].join(" ")}
              >
                {isReview || reviewWord ? (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black bn-semantic-warn">
                    <span className="rounded-md px-2 py-0.5 text-[10px] tracking-wide bn-semantic-badge">REVIEW</span>
                    <span>
                      {[
                        isReview ? "苦手な文法" : null,
                        reviewWord ? `復習単語「${reviewWord}」` : null,
                      ]
                        .filter(Boolean)
                        .join("・")}
                      を出題しています
                    </span>
                  </div>
                ) : null}

                <AnswerTimer
                  key={currentQuestion.id}
                  level={currentQuestion.level}
                  paused={isGrading || Boolean(gradeResult)}
                  onExpire={handleTimerExpire}
                />

                <QuestionCard question={currentQuestion} mode={isCompactMode ? "compact" : "hero"} />

                <div className="transition-all duration-700 ease-out">
                  <AnswerInput
                    value={userInput}
                    onChange={setUserInput}
                    language={currentQuestion.targetLanguage}
                    disabled={!!gradeResult || isGrading}
                  />
                </div>

                {gradeResult ? <ResultPanel result={gradeResult} question={currentQuestion} /> : null}

                {!gradeResult ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleJudge()}
                      disabled={(userInput.trim().length === 0 && !timeExpired) || isGrading}
                      className="min-h-14 w-full rounded-lg bg-zinc-950 text-lg font-black text-white shadow-sm transition-colors hover:bg-[var(--bn-good-solid)] disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-[var(--bn-good-solid)] dark:hover:text-zinc-950 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-300"
                    >
                      {isGrading ? "採点中…" : timeExpired ? "時間切れでも判定する" : "判定する"}
                    </button>
                    {gradeError ? <p className="text-center text-xs font-bold bn-text-bad">{gradeError}</p> : null}
                  </>
                ) : null}
              </section>

              {isCompactMode ? (
                <aside className="flex min-w-0 translate-y-0 flex-col gap-4 self-start opacity-100 transition-all duration-700 ease-out">
                  {isGrading && !gradeResult ? (
                    <div className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm dark:border-sky-900 dark:bg-zinc-900">
                      <p className="text-sm font-black text-sky-700 dark:text-sky-300">AI が採点しています</p>
                      <div className="mt-4 flex flex-col gap-2">
                        <div className="h-3 w-3/4 animate-pulse rounded-full bg-sky-100" />
                        <div className="h-3 w-full animate-pulse rounded-full bg-[var(--bn-good-bg-strong)]" />
                        <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--bn-warn-bg-strong)]" />
                      </div>
                    </div>
                  ) : null}

                  {gradeResult ? <AssessmentPanel result={gradeResult} /> : null}
                </aside>
              ) : null}
            </div>

            {gradeResult ? (
              <section className="flex flex-col gap-4">
                <ExplanationPanel
                  markdown={gradeResult.explanationMarkdown}
                  words={gradeResult.words}
                  language={currentQuestion.targetLanguage}
                />
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isGenerating}
                  className="mx-auto min-h-14 w-full max-w-md rounded-lg bg-zinc-950 text-lg font-black text-white shadow-sm transition-colors hover:bg-[var(--bn-good-solid)] disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-[var(--bn-good-solid)]"
                >
                  {isGenerating ? "AI が問題を生成中…" : "次の問題"}
                </button>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
