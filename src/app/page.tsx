"use client";

import { useCallback, useState } from "react";
import type { Question, TargetLanguage, Level } from "@/types/question";
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
import ProgressMeter from "@/components/ProgressMeter";
import StudyStatusView from "@/components/StudyStatusView";
import AnswerTimer from "@/components/AnswerTimer";
import AssessmentPanel from "@/components/AssessmentPanel";

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
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage | null>(null);
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
    startQuestion(lang);
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
      <StudyStatusView
        initialLanguage={targetLanguage}
        onClose={handleCloseStudyStatus}
      />
    );
  }

  // ── 言語選択画面 ──
  if (!targetLanguage) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-[#fbfaf6] px-5 py-8">
        <div className="flex w-full max-w-3xl flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-black text-emerald-700">
              A1 から自動スタート
            </div>
            <h1 className="text-4xl font-black text-zinc-950 sm:text-5xl">Become Native!</h1>
            <p className="max-w-xl text-sm font-bold leading-relaxed text-zinc-500">
              ネイティブ話者にも自然に通じる会話を、即答力まで鍛える練習アプリです。
            </p>
          </div>
          <div className="flex w-full flex-col gap-3">
            <div className="grid w-full gap-3 sm:grid-cols-3">
              {TARGET_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleSelectLanguage(lang)}
                  className="min-h-28 w-full rounded-lg border border-zinc-200 bg-white px-4 text-xl font-black text-zinc-950 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 active:translate-y-0"
                >
                  {LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowStudyStatus(true)}
              className="min-h-11 w-full rounded-lg border border-zinc-200 bg-white text-sm font-black text-zinc-600 transition-colors hover:bg-sky-50 hover:text-sky-700"
            >
              学習状況を見る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 初回ローディング画面 ──
  if (isGenerating && !currentQuestion) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-[#fbfaf6] px-6">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-base font-black text-zinc-800">
            {LANGUAGE_LABELS[targetLanguage]}（{progress?.level ?? "A1"}）の問題を生成中…
          </p>
          <div className="h-2 w-52 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-400" />
          </div>
          <p className="text-xs font-bold text-zinc-400">少々お待ちください</p>
        </div>
      </div>
    );
  }

  // ── 生成エラー画面 ──
  if (generateError && !currentQuestion) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-[#fbfaf6] px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-rose-100 bg-white p-6 text-center shadow-sm">
          <p className="text-base font-black text-zinc-900">問題を生成できませんでした</p>
          <p className="text-sm font-semibold text-rose-600">{generateError}</p>
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
    <div className="min-h-full bg-[#fbfaf6]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-3 lg:grid-cols-[minmax(220px,0.75fr)_minmax(420px,1.25fr)_auto] lg:items-center">
          <div>
            <h1 className="text-2xl font-black text-zinc-950">Become Native!</h1>
            <p className="text-xs font-bold text-zinc-500">
              {LANGUAGE_LABELS[targetLanguage]}・学習単語 {wordStats.learned}
              {wordStats.review > 0 ? `・復習 ${wordStats.review}` : ""}
            </p>
          </div>

          <ProgressMeter progress={progress} />

          <div className="flex flex-wrap items-center gap-1 lg:justify-end">
            <button
              type="button"
              onClick={() => setShowStudyStatus(true)}
              className="rounded-lg px-3 py-2 text-xs font-black text-zinc-500 transition-colors hover:bg-white hover:text-emerald-700"
            >
              学習状況
            </button>
            <button
              type="button"
              onClick={handleChangeLanguage}
              className="rounded-lg px-3 py-2 text-xs font-black text-zinc-400 transition-colors hover:bg-white hover:text-zinc-700"
            >
              言語を変更
            </button>
          </div>
        </header>

        {currentQuestion ? (
          <div
            className={[
              "transition-all duration-700 ease-out",
              isCompactMode
                ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,520px)] lg:items-start"
                : "mx-auto flex w-full max-w-4xl flex-col gap-4 pt-4 lg:pt-8",
            ].join(" ")}
          >
            <section
              className={[
                "flex min-w-0 flex-col gap-4 transition-all duration-700 ease-out",
                isCompactMode ? "lg:pt-0" : "lg:gap-5",
              ].join(" ")}
            >
              {isReview || reviewWord ? (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                  <span className="rounded-md bg-white px-2 py-0.5 text-[10px] tracking-wide">REVIEW</span>
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
                    className="min-h-12 w-full rounded-lg bg-zinc-950 text-base font-black text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {isGrading ? "採点中…" : timeExpired ? "時間切れでも判定する" : "判定する"}
                  </button>
                  {gradeError ? <p className="text-center text-xs font-bold text-rose-600">{gradeError}</p> : null}
                </>
              ) : null}
            </section>

            {isCompactMode ? (
              <aside className="flex min-w-0 translate-y-0 flex-col gap-4 opacity-100 transition-all duration-700 ease-out lg:sticky lg:top-5">
                {isGrading && !gradeResult ? (
                  <div className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm">
                    <p className="text-sm font-black text-sky-700">AI が採点しています</p>
                    <div className="mt-4 flex flex-col gap-2">
                      <div className="h-3 w-3/4 animate-pulse rounded-full bg-sky-100" />
                      <div className="h-3 w-full animate-pulse rounded-full bg-emerald-100" />
                      <div className="h-3 w-2/3 animate-pulse rounded-full bg-amber-100" />
                    </div>
                  </div>
                ) : null}

                {gradeResult ? (
                  <>
                    <AssessmentPanel result={gradeResult} />
                    <ExplanationPanel markdown={gradeResult.explanationMarkdown} />
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={isGenerating}
                      className="min-h-12 w-full rounded-lg bg-zinc-950 text-base font-black text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {isGenerating ? "AI が問題を生成中…" : "次の問題"}
                    </button>
                  </>
                ) : null}
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
