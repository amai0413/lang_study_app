import type { Question } from "@/types/question";

const levelLabel: Record<Question["level"], string> = {
  A1: "初級 (A1)",
  A2: "初中級 (A2)",
  B1: "中級 (B1)",
  B2: "中上級 (B2)",
};

export default function QuestionCard({ question }: { question: Question }) {
  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <span className="w-fit rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
        {levelLabel[question.level]}
      </span>
      <p className="text-sm font-medium text-zinc-400">この日本語の文を、声または手入力で答えてください</p>
      <p className="text-2xl font-bold leading-relaxed text-zinc-900 sm:text-3xl">
        {question.japanesePrompt}
      </p>
    </div>
  );
}
