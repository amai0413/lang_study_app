import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  h1: (props) => <h1 className="mt-2 text-lg font-bold text-zinc-900" {...props} />,
  h2: (props) => <h2 className="mt-4 text-base font-bold text-zinc-900" {...props} />,
  h3: (props) => <h3 className="mt-3 text-sm font-bold text-zinc-900" {...props} />,
  p: (props) => <p className="mt-2 text-sm leading-relaxed text-zinc-700" {...props} />,
  ul: (props) => <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700" {...props} />,
  li: (props) => <li {...props} />,
  strong: (props) => <strong className="font-semibold text-zinc-900" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="mt-1 ml-4 border-l-2 border-zinc-300 pl-3 text-sm text-zinc-500"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-zinc-100" {...props} />,
  th: (props) => (
    <th className="border border-zinc-200 px-2 py-1 text-left font-semibold text-zinc-700" {...props} />
  ),
  td: (props) => <td className="border border-zinc-200 px-2 py-1 text-zinc-700" {...props} />,
  pre: (props) => (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100" {...props} />
  ),
  code: (props) => <code className="font-mono" {...props} />,
};

export default function ExplanationPanel({ markdown }: { markdown?: string }) {
  if (!markdown) return null;
  return (
    <div className="w-full rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">文法解説</p>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
