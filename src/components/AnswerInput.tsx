"use client";

interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function AnswerInput({ value, onChange, disabled }: AnswerInputProps) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder="ここに回答を入力してください。"
      rows={3}
      className="min-h-28 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base font-semibold text-zinc-900 outline-none transition-colors placeholder:font-medium placeholder:text-zinc-400 focus:border-emerald-500 disabled:bg-zinc-50 disabled:text-zinc-400"
    />
  );
}
