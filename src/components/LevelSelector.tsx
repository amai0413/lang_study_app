"use client";

import type { Level } from "@/types/question";

const LEVELS: { value: Level; label: string }[] = [
  { value: "A1", label: "A1" },
  { value: "A2", label: "A2" },
  { value: "B1", label: "B1" },
  { value: "B2", label: "B2" },
];

interface LevelSelectorProps {
  value: Level;
  onChange: (level: Level) => void;
  disabled?: boolean;
}

export default function LevelSelector({ value, onChange, disabled }: LevelSelectorProps) {
  return (
    <div className="grid w-full grid-cols-4 gap-1.5 rounded-xl bg-zinc-100 p-1">
      {LEVELS.map((lvl) => (
        <button
          key={lvl.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(lvl.value)}
          className={`min-h-9 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
            value === lvl.value ? "bg-white text-zinc-900 shadow" : "text-zinc-500"
          }`}
        >
          {lvl.label}
        </button>
      ))}
    </div>
  );
}
