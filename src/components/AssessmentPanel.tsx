import type { AnswerAssessment, GradeResult, WordEntry } from "@/lib/grade";

const itemStyles = {
  correct: {
    mark: "◯",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  partial: {
    mark: "△",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  incorrect: {
    mark: "×",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
};

const sectionLabels: Record<keyof AnswerAssessment, string> = {
  vocabulary: "単語",
  grammar: "文法",
  naturalness: "自然さ",
};

function wordStyle(word: WordEntry): { label: string; className: string } {
  const status = word.correctness ?? (word.remembered ? "correct" : "incorrect");
  if (status === "correct") {
    return { label: "記憶済み", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  }
  if (status === "partial") {
    return { label: "一部OK", className: "border-amber-200 bg-amber-50 text-amber-800" };
  }
  return { label: "復習", className: "border-rose-200 bg-rose-50 text-rose-800" };
}

export default function AssessmentPanel({ result }: { result: GradeResult }) {
  const assessment = result.answerAssessment;
  const words = result.words ?? [];

  if (!assessment && words.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-zinc-400">Instant Feedback</p>

      {words.length > 0 ? (
        <section className="mt-3">
          <h2 className="text-sm font-black text-zinc-900">単語解説</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {words.map((word, index) => {
              const style = wordStyle(word);
              return (
                <div key={`${word.surface}-${index}`} className={`rounded-lg border p-3 ${style.className}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="break-words text-base font-black">{word.surface}</p>
                    <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-black">
                      {style.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold opacity-80">
                    {word.pos}
                    {word.reading ? ` / ${word.reading}` : ""}
                  </p>
                  {word.meaning ? <p className="mt-1 text-sm font-semibold">{word.meaning}</p> : null}
                  {word.note ? <p className="mt-1 text-xs leading-relaxed opacity-90">{word.note}</p> : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {assessment ? (
        <section className="mt-4">
          <h2 className="text-sm font-black text-zinc-900">あなたの回答について</h2>
          <div className="mt-2 grid gap-2">
            {(Object.keys(sectionLabels) as Array<keyof AnswerAssessment>).map((key) => {
              const item = assessment[key];
              const style = itemStyles[item.status];
              return (
                <div key={key} className={`rounded-lg border p-3 ${style.className}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black">{sectionLabels[key]}</span>
                    <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-sm font-black">
                      {style.mark}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold leading-relaxed">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
