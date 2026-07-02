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

export default function ExplanationPanel({ markdown }: { markdown?: string }) {
  if (!markdown) return null;
  return (
    <div className="w-full rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <p className="text-xs font-black uppercase tracking-wide text-zinc-400">文法解説</p>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
