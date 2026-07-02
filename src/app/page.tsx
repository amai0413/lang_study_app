"use client";

import { useState } from "react";
import type { Question, TargetLanguage, Level } from "@/types/question";
import { fetchGrade, type GradeResult } from "@/lib/grade";
import { appendHistory, loadHistory } from "@/lib/storage";
import { selectTarget, type QuizTarget } from "@/lib/selectTarget";
import { recordMasteryAttempt } from "@/lib/masteryStore";
import { recordWords, getWordStats } from "@/lib/wordStore";
import { LANGUAGE_LABELS, TARGET_LANGUAGES } from "@/lib/languages";
import QuestionCard from "@/components/QuestionCard";
import AnswerInput from "@/components/AnswerInput";
import ResultPanel from "@/components/ResultPanel";
import ExplanationPanel from "@/components/ExplanationPanel";
import LevelSelector from "@/components/LevelSelector";
import StudyStatusView from "@/components/StudyStatusView";

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
  const [level, setLevel] = useState<Level>("A1");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [isReview, setIsReview] = useState(false);
  const [showStudyStatus, setShowStudyStatus] = useState(false);
  const [wordStats, setWordStats] = useState<{ learned: number; review: number }>({
    learned: 0,
    review: 0,
  });

  const startQuestion = async (lang: TargetLanguage, lvl: Level) => {
    setIsGenerating(true);
    setGenerateError(null);
    setGradeError(null);
    setCurrentQuestion(null);
    setGradeResult(null);
    setUserInput("");
    setWordStats(getWordStats(lang));
    // カリキュラム＋習得度から出題対象を選ぶ（弱点/忘れた単語を復習に混ぜる）
    const target = selectTarget(lang, lvl);
    setIsReview(target.isReview);
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
    startQuestion(lang, level);
  };

  const handleLevelChange = (nextLevel: Level) => {
    setLevel(nextLevel);
    if (targetLanguage) startQuestion(targetLanguage, nextLevel);
  };

  const handleJudge = async () => {
    if (!currentQuestion || userInput.trim().length === 0) return;
    setIsGrading(true);
    setGradeError(null);
    try {
      const result = await fetchGrade(currentQuestion, userInput);
      setGradeResult(result);

      const wasCorrect = result.status === "correct" || result.status === "acceptable";

      // 履歴に保存（acceptable は correct 扱い）
      const history = loadHistory();
      appendHistory(history, {
        questionId: currentQuestion.id,
        targetLanguage: currentQuestion.targetLanguage,
        userInput,
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
    } catch (err) {
      setGradeError(err instanceof Error ? err.message : "採点に失敗しました。");
    } finally {
      setIsGrading(false);
    }
  };

  const handleNext = () => {
    if (targetLanguage) startQuestion(targetLanguage, level);
  };

  const handleChangeLanguage = () => {
    setTargetLanguage(null);
    setCurrentQuestion(null);
    setGradeResult(null);
    setUserInput("");
    setGenerateError(null);
    setGradeError(null);
    setIsGenerating(false);
    setIsGrading(false);
  };

  if (showStudyStatus) {
    return (
      <StudyStatusView
        initialLanguage={targetLanguage}
        onClose={() => {
          setShowStudyStatus(false);
          if (targetLanguage) setWordStats(getWordStats(targetLanguage));
        }}
      />
    );
  }

  // ── 言語選択画面 ──
  if (!targetLanguage) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-white px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold text-zinc-900">Grammar Trainer</h1>
            <p className="text-sm text-zinc-500">学習する言語を選んでください</p>
          </div>
          <div className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-zinc-400">難易度</p>
              <LevelSelector value={level} onChange={setLevel} />
            </div>
            <div className="flex w-full flex-col gap-3">
              {TARGET_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleSelectLanguage(lang)}
                  className="min-h-16 w-full rounded-2xl border border-zinc-200 bg-white text-lg font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 active:bg-zinc-100"
                >
                  {LANGUAGE_LABELS[lang]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowStudyStatus(true)}
              className="min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100"
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
      <div className="flex min-h-full flex-col items-center justify-center bg-white px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-base font-medium text-zinc-700">
            {LANGUAGE_LABELS[targetLanguage]}（{level}）の問題を生成中…
          </p>
          <p className="text-xs text-zinc-400">少々お待ちください</p>
        </div>
      </div>
    );
  }

  // ── 生成エラー画面 ──
  if (generateError && !currentQuestion) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-white px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-base font-semibold text-zinc-900">問題を生成できませんでした</p>
          <p className="text-sm text-rose-600">{generateError}</p>
          <button
            type="button"
            onClick={() => startQuestion(targetLanguage, level)}
            className="min-h-11 rounded-xl bg-zinc-900 px-6 text-sm font-semibold text-white"
          >
            再試行
          </button>
          <button type="button" onClick={handleChangeLanguage} className="text-sm text-zinc-400">
            言語選択に戻る
          </button>
        </div>
      </div>
    );
  }

  // ── クイズ画面 ──
  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6 sm:py-10">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-zinc-900">Grammar Trainer</h1>
            <p className="text-xs text-zinc-500">
              {LANGUAGE_LABELS[targetLanguage]}・学習単語 {wordStats.learned}
              {wordStats.review > 0 ? `・復習 ${wordStats.review}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setShowStudyStatus(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800"
            >
              学習状況
            </button>
            <button
              type="button"
              onClick={handleChangeLanguage}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
            >
              言語を変更
            </button>
          </div>
        </header>

        <LevelSelector value={level} onChange={handleLevelChange} disabled={isGenerating || isGrading} />

        {currentQuestion ? (
          <>
            {isReview ? (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                <span>🔁</span>
                <span>復習: 苦手な文法を出題しています</span>
              </div>
            ) : null}

            <QuestionCard question={currentQuestion} />

            <AnswerInput value={userInput} onChange={setUserInput} disabled={!!gradeResult || isGrading} />

            {gradeResult ? (
              <>
                <ResultPanel result={gradeResult} question={currentQuestion} />
                <ExplanationPanel markdown={gradeResult.explanationMarkdown} />
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isGenerating}
                  className="min-h-12 w-full rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:opacity-60"
                >
                  {isGenerating ? "AI が問題を生成中…" : "次の問題"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleJudge}
                  disabled={userInput.trim().length === 0 || isGrading}
                  className="min-h-12 w-full rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {isGrading ? "採点中…" : "判定する"}
                </button>
                {gradeError ? (
                  <p className="text-center text-xs text-rose-600">{gradeError}</p>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
