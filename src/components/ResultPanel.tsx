import type { GradeResult, GradeStatus } from "@/lib/grade";
import type { Question } from "@/types/question";
import { speechLanguageFor } from "@/lib/speech";
import SpeakButton from "./SpeakButton";

const statusStyles: Record<GradeStatus, { label: string; className: string }> = {
  correct: {
    label: "正解",
    className: "bn-semantic-good",
  },
  acceptable: {
    label: "正解（より自然な言い方あり）",
    className: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-100",
  },
  close: {
    label: "惜しい",
    className: "bn-semantic-warn",
  },
  incorrect: {
    label: "不正解",
    className: "bn-semantic-bad",
  },
};

function tokenizeAnswer(answer: string, result: GradeResult): string[] {
  const surfaces = [...(result.words ?? [])]
    .map((word) => word.surface)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const tokens: string[] = [];
  let index = 0;
  while (index < answer.length) {
    const matched = surfaces.find((surface) => answer.startsWith(surface, index));
    if (matched) {
      tokens.push(matched);
      index += matched.length;
    } else if (/\s/.test(answer[index])) {
      let end = index + 1;
      while (end < answer.length && /\s/.test(answer[end])) end += 1;
      tokens.push(answer.slice(index, end));
      index = end;
    } else {
      let end = index + 1;
      while (
        end < answer.length &&
        !/\s/.test(answer[end]) &&
        !surfaces.some((surface) => answer.startsWith(surface, end))
      ) {
        end += 1;
      }
      tokens.push(answer.slice(index, end));
      index = end;
    }
  }
  return tokens;
}

function wordInfo(result: GradeResult, token: string) {
  const clean = token.replace(/[。！？!?.,，、¿¡]/g, "");
  if (!clean.trim()) return undefined;
  return result.words?.find(
    (word) => {
      const surface = word.surface.replace(/[。！？!?.,，、¿¡]/g, "").trim();
      if (!surface) return false;
      return surface === clean || clean.includes(surface);
    },
  );
}

function modelAnswerNotes(markdown: string): { natural?: string; literal?: string } {
  const lines = markdown.split("\n");
  let inSection = false;
  const notes: { natural?: string; literal?: string } = {};

  for (const line of lines) {
    if (line.startsWith("## ")) {
      inSection = line.startsWith("## 例文") || line.startsWith("## 模範解答の補足");
      continue;
    }
    if (!inSection) continue;
    if (line.startsWith("**自然な訳：**")) {
      notes.natural = line.replace("**自然な訳：**", "").trim();
    }
    if (line.startsWith("> 直訳:") || line.startsWith("> 直訳：")) {
      notes.literal = line.replace(/^>\s*直訳[:：]\s*/, "").trim();
    }
  }

  return notes;
}

export default function ResultPanel({
  result,
  question,
}: {
  result: GradeResult;
  question: Question;
}) {
  const style = statusStyles[result.status];
  const notes = modelAnswerNotes(result.explanationMarkdown);

  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-5 ${style.className}`}>
      <span className="w-fit rounded-full bg-white/60 px-3 py-1 text-base font-bold dark:bg-zinc-950/50">
        {style.label}
      </span>
      <p className="text-base font-bold leading-relaxed">{result.feedback}</p>

      {result.betterExpression && result.status !== "correct" ? (
        <div className="mt-1 rounded-lg bg-white/70 p-3 dark:bg-zinc-950/50">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">より自然な言い方</p>
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{result.betterExpression}</p>
        </div>
      ) : null}

      <div className="mt-1 rounded-lg bg-white/70 p-3 dark:bg-zinc-950/50">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">模範解答</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <p className="min-w-0 text-xl font-semibold text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            {tokenizeAnswer(question.strictAnswer, result).map((token, index) => {
              const info = wordInfo(result, token);
              if (!info || !token.trim()) return <span key={`${token}-${index}`}>{token}</span>;
              return (
                <span key={`${token}-${index}`} className="group relative inline-block">
                  <span className="cursor-help rounded px-0.5 underline decoration-[var(--bn-good-solid)] decoration-2 underline-offset-4 transition-colors group-hover:bg-[var(--bn-good-bg)]">
                    {token}
                  </span>
                  <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 hidden w-56 rounded-lg border border-zinc-200 bg-white p-3 text-left text-xs font-bold text-zinc-700 shadow-lg group-hover:block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    <span className="block text-base font-black text-zinc-950 dark:text-zinc-50">{info.surface}</span>
                    <span className="mt-1 block">{info.meaning}</span>
                    <span className="mt-1 block text-zinc-400">
                      {info.pos}
                      {info.reading ? ` / ${info.reading}` : ""}
                    </span>
                  </span>
                </span>
              );
            })}
          </p>
          <SpeakButton
            text={question.strictAnswer}
            lang={speechLanguageFor(question.targetLanguage)}
            label="模範解答を再生"
            preload
          />
        </div>
        <p className="mt-2 text-sm font-bold text-zinc-500 dark:text-zinc-400">文法ポイント: {question.grammarPoint}</p>
        <div className="mt-3 grid gap-2 rounded-lg bg-white/60 p-3 dark:bg-zinc-900/70">
          <p className="text-base font-bold text-zinc-700 dark:text-zinc-200">
            <span className="text-zinc-400 dark:text-zinc-500">日本語訳: </span>
            {notes.natural || question.japanesePrompt}
          </p>
          {notes.literal ? (
            <p className="border-l-2 border-zinc-300 pl-3 text-base font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              直訳: {notes.literal}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
