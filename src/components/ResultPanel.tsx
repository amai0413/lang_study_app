import type { GradeResult, GradeStatus } from "@/lib/grade";
import type { Question } from "@/types/question";
import { speechLanguageFor } from "@/lib/speech";
import SpeakButton from "./SpeakButton";

const statusStyles: Record<GradeStatus, { label: string; className: string }> = {
  correct: { label: "正解", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  acceptable: {
    label: "正解（より自然な言い方あり）",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  close: { label: "惜しい", className: "border-amber-200 bg-amber-50 text-amber-800" },
  incorrect: { label: "不正解", className: "border-rose-200 bg-rose-50 text-rose-800" },
};

export default function ResultPanel({
  result,
  question,
}: {
  result: GradeResult;
  question: Question;
}) {
  const style = statusStyles[result.status];

  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-4 ${style.className}`}>
      <span className="w-fit rounded-full bg-white/60 px-3 py-1 text-sm font-bold">
        {style.label}
      </span>
      <p className="text-sm leading-relaxed">{result.feedback}</p>

      {result.betterExpression && result.status !== "correct" ? (
        <div className="mt-1 rounded-lg bg-white/70 p-3">
          <p className="text-xs font-medium text-zinc-500">より自然な言い方</p>
          <p className="text-lg font-semibold text-zinc-900">{result.betterExpression}</p>
        </div>
      ) : null}

      <div className="mt-1 rounded-lg bg-white/70 p-3">
        <p className="text-xs font-medium text-zinc-500">模範解答</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <p className="min-w-0 text-lg font-semibold text-zinc-900">{question.strictAnswer}</p>
          <SpeakButton
            text={question.strictAnswer}
            lang={speechLanguageFor(question.targetLanguage)}
            label="模範解答を再生"
          />
        </div>
        <p className="mt-1 text-xs text-zinc-500">文法ポイント: {question.grammarPoint}</p>
      </div>
    </div>
  );
}
