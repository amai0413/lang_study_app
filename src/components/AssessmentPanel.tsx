import type { AnswerAssessment, GradeResult } from "@/lib/grade";

const itemStyles = {
  correct: { mark: "◯", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  partial: { mark: "△", className: "border-amber-200 bg-amber-50 text-amber-800" },
  incorrect: { mark: "×", className: "border-rose-200 bg-rose-50 text-rose-800" },
};

const sectionLabels: Record<keyof AnswerAssessment, string> = {
  vocabulary: "単語",
  grammar: "文法",
  naturalness: "自然さ",
};

export default function AssessmentPanel({ result }: { result: GradeResult }) {
  const assessment = result.answerAssessment;

  if (!assessment) return null;

  return (
    <div className="h-full rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-black uppercase tracking-wide text-zinc-400">Your Answer</p>
      <div className="mt-4 grid gap-4">
        {(Object.keys(sectionLabels) as Array<keyof AnswerAssessment>).map((key) => {
          const item = assessment[key];
          const style = itemStyles[item.status];
          return (
            <section key={key} className={`rounded-lg border p-4 ${style.className}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">{sectionLabels[key]}</h2>
                <span className="rounded-full bg-white/70 px-3 py-1 text-xl font-black">
                  {style.mark}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold leading-relaxed">{item.detail}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
