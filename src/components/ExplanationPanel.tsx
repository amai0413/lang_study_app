import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

function childText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(childText).join("");
  return "";
}

const markStyles: Record<string, string> = {
  "◯": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "△": "text-amber-700 bg-amber-50 border-amber-200",
  "×": "text-rose-700 bg-rose-50 border-rose-200",
};

interface WordTableRow {
  word: string;
  reading: string;
  pos: string;
  meaning: string;
  note: string;
}

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

const markdownComponents: Components = {
  h1: (props) => <h1 className="mt-2 text-xl font-black text-zinc-900" {...props} />,
  h2: (props) => (
    <h2
      className="mt-6 rounded-lg bg-zinc-50 px-3 py-2 text-xl font-black text-zinc-900"
      {...props}
    />
  ),
  h3: (props) => <h3 className="mt-4 text-lg font-black text-zinc-900" {...props} />,
  p: (props) => <p className="mt-2 text-base leading-relaxed text-zinc-700" {...props} />,
  ul: (props) => <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-zinc-700" {...props} />,
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
      <strong className="font-black text-zinc-900" {...props}>
        {children}
      </strong>
    );
  },
  blockquote: (props) => (
    <blockquote
      className="mt-2 ml-4 border-l-2 border-zinc-300 pl-3 text-base text-zinc-500"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-zinc-100" {...props} />,
  th: (props) => (
    <th className="border border-zinc-200 px-3 py-2 text-left font-black text-zinc-700" {...props} />
  ),
  td: (props) => <td className="border border-zinc-200 px-3 py-2 text-zinc-700" {...props} />,
  pre: (props) => (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100" {...props} />
  ),
  code: (props) => <code className="font-mono" {...props} />,
};

const patternPracticeComponents: Components = {
  ...markdownComponents,
  p: (props) => <p className="mt-3 text-base leading-relaxed text-zinc-700" {...props} />,
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
        className="mr-2 inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-black text-sky-800"
        {...props}
      >
        {children}
      </strong>
    );
  },
  ul: (props) => (
    <ul className="mt-3 grid gap-2 text-base text-zinc-700 sm:grid-cols-2" {...props} />
  ),
  li: (props) => (
    <li
      className="list-none rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2 font-bold leading-relaxed text-zinc-700"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mt-4 overflow-x-auto rounded-lg border border-indigo-100 bg-white">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-indigo-50" {...props} />,
  th: (props) => (
    <th className="border-b border-indigo-100 px-3 py-2 text-left font-black text-indigo-900" {...props} />
  ),
  td: (props) => (
    <td className="border-t border-indigo-50 px-3 py-3 align-top font-bold text-zinc-700" {...props} />
  ),
};

export default function ExplanationPanel({ markdown }: { markdown?: string }) {
  if (!markdown) return null;
  const { lead, sections } = splitFoldableSections(markdown);
  return (
    <div className="w-full rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <p className="text-xs font-black uppercase tracking-wide text-zinc-400">文法解説</p>
      {lead ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {lead}
        </ReactMarkdown>
      ) : null}
      {sections.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <h2 className="rounded-lg bg-white px-3 py-2 text-xl font-black text-zinc-900">
                {section.title}
              </h2>
              <div className="mt-3 rounded-lg bg-white p-4">
                {section.title.includes("単語解説") ? (
                  <WordExplanation body={section.body} />
                ) : section.title.includes("そのまま使える型") ||
                  section.title.includes("覚えておきたい構文") ? (
                  <PatternPractice body={section.body} />
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

function PatternPractice({ body }: { body: string }) {
  return (
    <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={patternPracticeComponents}>
        {body}
      </ReactMarkdown>
    </div>
  );
}

function WordExplanation({ body }: { body: string }) {
  const rows = parseWordRows(body);
  const rest = stripMarkdownTables(body);

  return (
    <div className="grid gap-4">
      {rows.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row, index) => (
            <article
              key={`${row.word}-${index}`}
              className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-4 text-emerald-950"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="break-words text-2xl font-black leading-tight">{row.word}</h3>
                {row.pos ? (
                  <span className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-xs font-black text-emerald-700">
                    {row.pos}
                  </span>
                ) : null}
              </div>
              {row.reading ? (
                <p className="mt-2 break-words text-sm font-black text-emerald-700">{row.reading}</p>
              ) : null}
              {row.meaning ? (
                <p className="mt-3 break-words rounded-lg bg-white/80 p-3 text-base font-black text-zinc-900">
                  {row.meaning}
                </p>
              ) : null}
              {row.note ? (
                <p className="mt-3 break-words border-l-2 border-emerald-300 pl-3 text-sm font-bold leading-relaxed text-zinc-600">
                  {row.note}
                </p>
              ) : null}
            </article>
          ))}
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
