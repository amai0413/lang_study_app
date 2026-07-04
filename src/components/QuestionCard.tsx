import type { Question } from "@/types/question";

const levelLabel: Record<Question["level"], string> = {
  A1: "初級 (A1)",
  A2: "初中級 (A2)",
  B1: "中級 (B1)",
  B2: "中上級 (B2)",
};

export default function QuestionCard({
  question,
  mode = "compact",
}: {
  question: Question;
  mode?: "hero" | "compact";
}) {
  const isHero = mode === "hero";

  return (
    <div
      className={[
        "flex w-full flex-col border border-zinc-200 bg-white shadow-sm transition-all duration-700 ease-out dark:border-zinc-800 dark:bg-zinc-900",
        isHero
          ? "items-center gap-5 rounded-lg px-5 py-8 text-center sm:px-8 sm:py-10 lg:py-14"
          : "items-start gap-4 rounded-lg p-5 text-left sm:p-6",
      ].join(" ")}
    >
      <span className="w-fit rounded-full border px-2.5 py-1 text-xs font-black bn-semantic-warn">
        {levelLabel[question.level]}
      </span>
      <p className="text-base font-bold text-zinc-400 dark:text-zinc-500">この日本語の文を、手入力または音声で答えてください</p>
      <p
        className={[
          "min-w-0 font-black leading-relaxed text-zinc-950 transition-all duration-700 ease-out dark:text-zinc-50",
          isHero ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl",
        ].join(" ")}
      >
        {question.japanesePrompt}
      </p>
    </div>
  );
}
