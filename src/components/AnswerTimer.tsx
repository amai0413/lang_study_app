"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Level } from "@/types/question";
import { ANSWER_TIME_LIMIT_SECONDS } from "@/lib/speech";

interface AnswerTimerProps {
  level: Level;
  paused?: boolean;
  onExpire?: () => void;
}

function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function AnswerTimer({ level, paused, onExpire }: AnswerTimerProps) {
  const limit = ANSWER_TIME_LIMIT_SECONDS[level];
  const [remaining, setRemaining] = useState(limit);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    if (paused || remaining <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [paused, remaining]);

  useEffect(() => {
    if (remaining !== 0 || hasExpiredRef.current) return;
    hasExpiredRef.current = true;
    onExpire?.();
  }, [onExpire, remaining]);

  const progress = useMemo(() => Math.round((remaining / limit) * 100), [limit, remaining]);
  const tone =
    remaining === 0
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : remaining <= 10
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-sky-100 bg-white text-sky-700";

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide">Speed Drill</p>
        <p className="text-lg font-black tabular-nums">{remaining === 0 ? "時間切れ" : formatTime(remaining)}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
        <div
          className="h-full rounded-full bg-current transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
