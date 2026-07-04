import type { AnswerAssessment, GradeResult } from "@/lib/grade";

const itemStyles = {
  correct: {
    mark: "◯",
    className: "bn-semantic-good",
    markClassName: "bn-mark-good",
  },
  partial: {
    mark: "△",
    className: "bn-semantic-warn",
    markClassName: "bn-mark-warn",
  },
  incorrect: {
    mark: "×",
    className: "bn-semantic-bad",
    markClassName: "bn-mark-bad",
  },
};

const sectionLabels: Record<keyof AnswerAssessment, string> = {
  vocabulary: "単語",
  grammar: "文法",
  naturalness: "自然さ",
};

export default function AssessmentPanel({ result }: { result: GradeResult }) {
  const assessment = result.answerAssessment;
  const correctWords =
    result.words?.filter((word) => (word.correctness ?? (word.remembered ? "correct" : "incorrect")) === "correct") ??
    [];
  const reviewWords =
    result.words?.filter((word) => (word.correctness ?? (word.remembered ? "correct" : "incorrect")) !== "correct") ??
    [];

  if (!assessment) return null;

  return (
    <div className="h-full rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-base font-black uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Your Answer</p>
      <p className="mt-2 rounded-lg bg-zinc-50 p-3 text-base font-bold leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
        {result.feedback}
      </p>
      <div className="mt-4 grid gap-4">
        {(Object.keys(sectionLabels) as Array<keyof AnswerAssessment>).map((key) => {
          const item = assessment[key];
          const style = itemStyles[item.status];
          return (
            <section key={key} className={`rounded-lg border p-4 ${style.className}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black">{sectionLabels[key]}</h2>
                <span className={`rounded-full border px-3 py-1 text-2xl font-black ${style.markClassName}`}>
                  {style.mark}
                </span>
              </div>
              <p className="mt-3 rounded-lg bg-white/55 p-3 text-base font-bold leading-relaxed text-current shadow-sm dark:bg-zinc-950/20">
                {item.detail}
              </p>
              {key === "vocabulary" && (correctWords.length > 0 || reviewWords.length > 0) ? (
                <div className="mt-4 grid gap-3">
                  {correctWords.length > 0 ? (
                    <div className="rounded-lg border p-3 bn-semantic-good-strong">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-xs font-black tracking-wide">できている単語</h3>
                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-black dark:bg-zinc-950/25">
                          {correctWords.length}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {correctWords.map((word) => (
                          <span
                            key={word.surface}
                            className="rounded-full bg-white/80 px-3 py-1.5 text-base font-black text-[var(--bn-good-text-strong)] shadow-sm dark:bg-zinc-950/25"
                          >
                            {word.surface}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {reviewWords.length > 0 ? (
                    <div className="rounded-lg border p-3 bn-semantic-warn-strong">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-xs font-black tracking-wide">復習する単語</h3>
                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-black dark:bg-zinc-950/25">
                          {reviewWords.length}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2">
                        {reviewWords.slice(0, 5).map((word) => (
                          <div
                            key={word.surface}
                            className="rounded-lg bg-white/85 p-3 text-[var(--bn-warn-text-strong)] shadow-sm dark:bg-zinc-950/25"
                          >
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                              <p className="text-base font-black leading-relaxed">{word.surface}</p>
                              {word.meaning ? (
                                <p className="text-sm font-black leading-relaxed opacity-85">{word.meaning}</p>
                              ) : null}
                            </div>
                            {word.note ? (
                              <p className="mt-2 border-l-2 border-[var(--bn-warn-border)] pl-2 text-sm font-bold leading-relaxed opacity-90">
                                {word.note}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
