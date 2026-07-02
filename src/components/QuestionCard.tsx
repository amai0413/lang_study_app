import type { Question } from "@/types/question";
import SpeakButton from "./SpeakButton";

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
        "flex w-full flex-col border border-zinc-200 bg-white shadow-sm transition-all duration-700 ease-out",
        isHero
          ? "items-center gap-4 rounded-lg px-5 py-8 text-center sm:px-8 sm:py-10 lg:py-14"
          : "items-start gap-3 rounded-lg p-4 text-left sm:p-5",
      ].join(" ")}
    >
      <span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700">
        {levelLabel[question.level]}
      </span>
      <p className="text-sm font-bold text-zinc-400">この日本語の文を、手入力または音声で答えてください</p>
      <div className={["flex w-full gap-3", isHero ? "flex-col items-center" : "items-start justify-between"].join(" ")}>
        <p
          className={[
            "min-w-0 font-black leading-relaxed text-zinc-950 transition-all duration-700 ease-out",
            isHero ? "text-3xl sm:text-4xl lg:text-5xl" : "text-2xl sm:text-3xl",
          ].join(" ")}
        >
          {question.japanesePrompt}
        </p>
        <SpeakButton text={question.japanesePrompt} lang="ja-JP" label="問題文を再生" />
      </div>
    </div>
  );
}
