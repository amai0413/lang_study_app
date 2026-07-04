import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { pinyin } from "pinyin-pro";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";
import type { WordEntry } from "@/lib/grade";
import { speechLanguageFor } from "@/lib/speech";
import type { TargetLanguage } from "@/types/question";
import SpeakButton from "@/components/SpeakButton";
import WordCard from "@/components/WordCard";

function childText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(childText).join("");
  return "";
}

const markStyles: Record<string, string> = {
  "◯": "bn-mark-good",
  "△": "bn-mark-warn",
  "×": "bn-mark-bad",
};

interface WordTableRow {
  word: string;
  reading: string;
  pos: string;
  meaning: string;
  note: string;
}

interface PatternSwapRow {
  term: string;
  reading: string;
  meaning: string;
  example: string;
}

interface PatternSummary {
  template?: string;
  meaning?: string;
  swaps: PatternSwapRow[];
  examples: string[];
  notes: string[];
  rest: string;
}

type WordStudyStatus = "remembered" | "review" | "unknown";

function splitFoldableSections(markdown: string): {
  lead: string;
  sections: Array<{ title: string; body: string }>;
} {
  const lines = markdown.split("\n");
  const sections: Array<{ title: string; body: string[] }> = [];
  const lead: string[] = [];
  let current: { title: string; body: string[] } | null = null;
  let skippedSection = "";

  for (const line of lines) {
    if (line.trim() === "# 文法解説") continue;
    if (line.startsWith("## ")) {
      skippedSection =
        line.startsWith("## 例文") ||
        line.startsWith("## 模範解答の補足") ||
        line.startsWith("## あなたの回答について")
          ? line
          : "";
      if (skippedSection) {
        current = null;
        continue;
      }
    }
    const match = line.match(/^##\s+(1\.|2\.|3\.)\s+(.+)$/);
    if (match) {
      skippedSection = "";
      current = { title: `${match[1]} ${match[2]}`, body: [] };
      sections.push(current);
      continue;
    }
    if (skippedSection) continue;
    if (current) {
      current.body.push(line);
    } else {
      lead.push(line);
    }
  }

  return {
    lead: lead.join("\n").trim(),
    sections: sections.map((section) => ({
      title: section.title,
      body: section.body.join("\n").trim(),
    })),
  };
}

function parseWordRows(markdown: string): WordTableRow[] {
  return markdown
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5)
    .filter((cells) => cells[0] !== "単語" && !cells.every((cell) => /^-+$/.test(cell)))
    .map(([word, reading, pos, meaning, note]) => ({ word, reading, pos, meaning, note }));
}

function stripMarkdownTables(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line) => !line.trim().startsWith("|"))
    .join("\n")
    .trim();
}

function afterBoldLabel(line: string, label: string): string {
  return line
    .replace(new RegExp(`^\\*\\*${label}[：:]\\*\\*\\s*`), "")
    .replace(new RegExp(`^\\*\\*${label}\\*\\*\\s*[：:]?\\s*`), "")
    .trim();
}

function parsePatternSwaps(markdown: string): PatternSwapRow[] {
  return markdown
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 3)
    .filter((cells) => cells[0] !== "入れる語" && !cells.every((cell) => /^-+$/.test(cell)))
    .map((cells) => {
      const [term, second, third, fourth] = cells;
      if (cells.length >= 4) {
        return { term, reading: second, meaning: third, example: fourth };
      }
      return { term, reading: "", meaning: second, example: third };
    });
}

function parsePatternSummary(body: string): PatternSummary {
  const swaps = parsePatternSwaps(body);
  const examples: string[] = [];
  const notes: string[] = [];
  const rest: string[] = [];
  let template = "";
  let meaning = "";
  let section: "swap" | "examples" | "notes" | "" = "";

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("**型")) {
      template = afterBoldLabel(line, "型");
      section = "";
      continue;
    }
    if (line.startsWith("**意味")) {
      meaning = afterBoldLabel(line, "意味");
      section = "";
      continue;
    }
    if (line.startsWith("**入れ替え")) {
      section = "swap";
      continue;
    }
    if (line.startsWith("**自分で言うなら")) {
      section = "examples";
      continue;
    }
    if (line.startsWith("**注意")) {
      section = "notes";
      continue;
    }
    if (line.startsWith("|")) continue;

    if (line.startsWith("- ")) {
      const item = line.slice(2).trim();
      if (section === "examples") {
        examples.push(item);
        continue;
      }
      if (section === "notes") {
        notes.push(item);
        continue;
      }
    }

    if (section !== "swap") rest.push(rawLine);
  }

  return {
    template,
    meaning,
    swaps,
    examples,
    notes,
    rest: rest.join("\n").trim(),
  };
}

function cleanWordSurface(value: string): string {
  return value.replace(/[。！？!?.,，、¿¡「」『』"'()\[\]]/g, "").trim();
}

function wordStudyStatus(row: WordTableRow, words?: WordEntry[]): WordStudyStatus {
  const rowWord = cleanWordSurface(row.word);
  const matched = words?.find((word) => {
    const surface = cleanWordSurface(word.surface);
    return surface === rowWord || surface.includes(rowWord) || rowWord.includes(surface);
  });
  if (!matched) return "unknown";
  const correctness = matched.correctness ?? (matched.remembered ? "correct" : "incorrect");
  return correctness === "correct" ? "remembered" : "review";
}

function readingMapFromWords(words?: WordEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const word of words ?? []) {
    const surface = cleanWordSurface(word.surface);
    const reading = word.reading?.trim();
    if (surface && reading) map.set(surface, reading);
  }
  return map;
}

function pinyinForChinese(text: string): string {
  const withoutPlaceholders = text.replace(/\[[^\]]*\]|［[^］]*］|【[^】]*】/g, "");
  const chineseText = withoutPlaceholders.replace(/[^\p{Script=Han}]+/gu, "");
  if (!chineseText) return "";
  try {
    return pinyin(chineseText, { toneType: "symbol" }).trim();
  } catch {
    return "";
  }
}

function resolveReading(
  text: string,
  language?: TargetLanguage,
  readings?: Map<string, string>,
): string {
  const clean = cleanWordSurface(text);
  if (!clean) return "";
  const exact = readings?.get(clean);
  if (language === "zh") return pinyinForChinese(clean) || exact || "";
  if (exact) return exact;

  const matched = [...(readings?.entries() ?? [])]
    .filter(([surface]) => clean.includes(surface))
    .sort(([a], [b]) => b.length - a.length)[0]?.[1];
  if (matched) return matched;

  return "";
}

const markdownComponents: Components = {
  h1: (props) => <h1 className="mt-2 text-xl font-black text-zinc-900 dark:text-zinc-50" {...props} />,
  h2: (props) => (
    <h2
      className="mt-6 rounded-lg bg-zinc-50 px-3 py-2 text-xl font-black text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
      {...props}
    />
  ),
  h3: (props) => <h3 className="mt-4 text-lg font-black text-zinc-900 dark:text-zinc-50" {...props} />,
  p: (props) => <p className="mt-2 text-base leading-relaxed text-zinc-700 dark:text-zinc-300" {...props} />,
  ul: (props) => <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-zinc-700 dark:text-zinc-300" {...props} />,
  li: (props) => <li {...props} />,
  strong: ({ children, ...props }) => {
    const text = childText(children).trim();
    if (markStyles[text]) {
      return (
        <strong
          className={`inline-flex min-w-11 items-center justify-center rounded-full border px-3 py-1 text-xl font-black ${markStyles[text]}`}
          {...props}
        >
          {children}
        </strong>
      );
    }
    return (
      <strong className="font-black text-zinc-900 dark:text-zinc-50" {...props}>
        {children}
      </strong>
    );
  },
  blockquote: (props) => (
    <blockquote
      className="mt-2 ml-4 border-l-2 border-zinc-300 pl-3 text-base text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-zinc-100 dark:bg-zinc-900" {...props} />,
  th: (props) => (
    <th className="border border-zinc-200 px-3 py-2 text-left font-black text-zinc-700 dark:border-zinc-800 dark:text-zinc-200" {...props} />
  ),
  td: (props) => <td className="border border-zinc-200 px-3 py-2 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300" {...props} />,
  pre: (props) => (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100" {...props} />
  ),
  code: (props) => <code className="font-mono" {...props} />,
};

const patternPracticeComponents: Components = {
  ...markdownComponents,
  p: (props) => <p className="mt-3 text-base leading-relaxed text-zinc-700 dark:text-zinc-300" {...props} />,
  strong: ({ children, ...props }) => {
    const text = childText(children).trim();
    if (markStyles[text]) {
      return (
        <strong
          className={`inline-flex min-w-11 items-center justify-center rounded-full border px-3 py-1 text-xl font-black ${markStyles[text]}`}
          {...props}
        >
          {children}
        </strong>
      );
    }
    return (
      <strong
        className="mr-2 inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-black text-sky-800 dark:bg-sky-950 dark:text-sky-200"
        {...props}
      >
        {children}
      </strong>
    );
  },
  ul: (props) => (
    <ul className="mt-3 grid gap-2 text-base text-zinc-700 dark:text-zinc-300 sm:grid-cols-2" {...props} />
  ),
  li: (props) => (
    <li
      className="list-none rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2 font-bold leading-relaxed text-zinc-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-zinc-200"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mt-4 overflow-x-auto rounded-lg border border-indigo-100 bg-white dark:border-indigo-900 dark:bg-zinc-950">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-indigo-50 dark:bg-indigo-950/60" {...props} />,
  th: (props) => (
    <th className="border-b border-indigo-100 px-3 py-2 text-left font-black text-indigo-900 dark:border-indigo-900 dark:text-indigo-100" {...props} />
  ),
  td: (props) => (
    <td className="border-t border-indigo-50 px-3 py-3 align-top font-bold text-zinc-700 dark:border-zinc-800 dark:text-zinc-300" {...props} />
  ),
};

export default function ExplanationPanel({
  markdown,
  words,
  language,
}: {
  markdown?: string;
  words?: WordEntry[];
  language?: TargetLanguage;
}) {
  if (!markdown) return null;
  const { lead, sections } = splitFoldableSections(markdown);
  return (
    <div className="w-full rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <p className="text-xs font-black uppercase tracking-wide text-zinc-400 dark:text-zinc-500">文法解説</p>
      {lead ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {lead}
        </ReactMarkdown>
      ) : null}
      {sections.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="rounded-lg bg-white px-3 py-2 text-xl font-black text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
                {section.title}
              </h2>
              <div className="mt-3 rounded-lg bg-white p-4 dark:bg-zinc-900">
                {section.title.includes("単語解説") ? (
                  <WordExplanation body={section.body} words={words} language={language} />
                ) : section.title.includes("そのまま使える型") ||
                  section.title.includes("覚えておきたい構文") ? (
                  <PatternPractice body={section.body} words={words} language={language} />
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {section.body}
                  </ReactMarkdown>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PatternPractice({
  body,
  words,
  language,
}: {
  body: string;
  words?: WordEntry[];
  language?: TargetLanguage;
}) {
  const pattern = parsePatternSummary(body);
  const readings = readingMapFromWords(words);
  const templateReading = resolveReading(pattern.template ?? "", language, readings);
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        {pattern.template ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-black uppercase tracking-wide bn-text-good">型</p>
            <p className="mt-2 break-words text-2xl font-black leading-relaxed text-zinc-950 dark:text-zinc-50">
              {pattern.template}
            </p>
            {templateReading ? (
              <p className="mt-2 break-words text-sm font-black text-sky-600 dark:text-sky-300">
                読み: {templateReading}
              </p>
            ) : null}
          </div>
        ) : null}
        {pattern.meaning ? (
          <div className="rounded-lg border p-4 bn-semantic-warn">
            <p className="text-xs font-black uppercase tracking-wide">意味</p>
            <p className="mt-2 text-base font-bold leading-relaxed">{pattern.meaning}</p>
          </div>
        ) : null}
      </div>

      {pattern.swaps.length > 0 ? (
        <section className="rounded-lg border border-sky-100 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/40">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-zinc-950 dark:text-zinc-50">入れ替え</h3>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-sky-700 dark:bg-zinc-900 dark:text-sky-200">
              {pattern.swaps.length}パターン
            </span>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {pattern.swaps.map((row, index) => (
              <article key={`${row.term}-${index}`} className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-950">
                {(() => {
                  const rowReading = row.reading || resolveReading(row.term, language, readings);
                  const exampleReading = resolveReading(row.example, language, readings);
                  return (
                    <>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-xl font-black text-zinc-950 dark:text-zinc-50">{row.term}</p>
                  {rowReading ? (
                    <p className="text-sm font-black text-sky-600 dark:text-sky-300">{rowReading}</p>
                  ) : null}
                  {row.meaning ? (
                    <p className="text-sm font-bold text-sky-700 dark:text-sky-300">{row.meaning}</p>
                  ) : null}
                </div>
                {row.example ? (
                  <div className="mt-3 flex items-start justify-between gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                    <p className="text-base font-black leading-relaxed text-zinc-800 dark:text-zinc-200">
                      {row.example}
                    </p>
                    {language ? (
                      <SpeakButton text={row.example} lang={speechLanguageFor(language)} label="音声" />
                    ) : null}
                  </div>
                ) : null}
                {exampleReading ? (
                  <p className="mt-2 break-words text-sm font-black text-sky-600 dark:text-sky-300">
                    読み: {exampleReading}
                  </p>
                ) : null}
                    </>
                  );
                })()}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {pattern.examples.length > 0 ? (
        <section className="rounded-lg border p-4 bn-semantic-good">
          <h3 className="text-lg font-black">自分で言うなら</h3>
          <div className="mt-3 grid gap-2">
            {pattern.examples.map((example, index) => {
              const [sentence, translation] = example.split("　");
              const sentenceReading = resolveReading(sentence, language, readings);
              return (
                <div key={`${example}-${index}`} className="rounded-lg bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-black leading-relaxed text-zinc-900">{sentence}</p>
                    {language ? (
                      <SpeakButton text={sentence} lang={speechLanguageFor(language)} label="音声" />
                    ) : null}
                  </div>
                  {sentenceReading ? (
                    <p className="mt-1 text-sm font-black leading-relaxed text-sky-600">{sentenceReading}</p>
                  ) : null}
                  {translation ? (
                    <p className="mt-1 text-sm font-bold leading-relaxed text-zinc-500">{translation}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {pattern.notes.length > 0 ? (
        <section className="rounded-lg border p-4 bn-semantic-bad">
          <h3 className="text-lg font-black">注意</h3>
          <div className="mt-3 grid gap-2">
            {pattern.notes.map((note, index) => (
              <p
                key={`${note}-${index}`}
                className="rounded-lg bg-white p-3 text-sm font-bold leading-relaxed text-zinc-700 shadow-sm"
              >
                {note}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {pattern.rest ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={patternPracticeComponents}>
          {pattern.rest}
        </ReactMarkdown>
      ) : null}
    </div>
  );
}

function WordExplanation({
  body,
  words,
  language,
}: {
  body: string;
  words?: WordEntry[];
  language?: TargetLanguage;
}) {
  const rows = parseWordRows(body);
  const rest = stripMarkdownTables(body);
  const readings = readingMapFromWords(words);

  return (
    <div className="grid gap-4">
      {rows.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row, index) => {
            const status = wordStudyStatus(row, words);
            const reading = row.reading || resolveReading(row.word, language, readings);
            return (
              <WordCard
                key={`${row.word}-${index}`}
                surface={row.word}
                reading={reading}
                meaning={row.meaning}
                pos={row.pos}
                note={row.note}
                status={status}
                language={language}
              />
            );
          })}
        </div>
      ) : null}
      {rest ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {rest}
        </ReactMarkdown>
      ) : null}
    </div>
  );
}
