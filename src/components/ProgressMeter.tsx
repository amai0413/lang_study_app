import { LEVEL_ORDER, MAX_SCORE, type LearningProgress } from "@/lib/progress";

interface ProgressMeterProps {
  progress: LearningProgress | null;
}

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function LevelRing({
  progress,
  compact,
}: {
  progress: LearningProgress | null;
  compact?: boolean;
}) {
  const level = progress?.level ?? "A1";
  const readiness = progress?.readiness ?? 0;

  return (
    <div
      className={`grid ${compact ? "size-14" : "size-24"} shrink-0 place-items-center rounded-full p-1.5`}
      style={{
        background: `conic-gradient(var(--bn-good-solid) ${readiness * 3.6}deg, var(--bn-progress-track) 0deg)`,
      }}
      aria-label={`次のレベルまで ${readiness}%`}
    >
      <div className="flex size-full flex-col items-center justify-center rounded-full bg-white dark:bg-zinc-950">
        <span
          className={`${compact ? "text-lg" : "text-3xl"} font-black leading-none text-zinc-950 dark:text-zinc-50`}
        >
          {level}
        </span>
        <span className={`mt-1 ${compact ? "text-[10px]" : "text-xs"} font-black bn-text-good`}>
          {readiness}%
        </span>
      </div>
    </div>
  );
}

export default function ProgressMeter({ progress }: ProgressMeterProps) {
  const level = progress?.level ?? "A1";
  const score = progress?.score ?? 0;
  const accuracy = progress?.attempts ? percentage(progress.accuracy) : "--";
  const attempts = progress?.attempts ?? 0;
  const correct = progress?.correct ?? 0;
  const levelMin = Math.max(LEVEL_ORDER.indexOf(level), 0) * 100;
  const levelMax = levelMin + 100;

  return (
    <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-[auto_1fr] md:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <LevelRing progress={progress} />
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-wide bn-text-good">現在のレベル</p>
          <p className="text-3xl font-black leading-tight text-zinc-950 dark:text-zinc-50">Score {score}</p>
          <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500">
            {level}帯: {levelMin}〜{levelMax}点（満点{MAX_SCORE}）
          </p>
        </div>
      </div>

      <div className="grid gap-2 text-center sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-black tracking-wide text-zinc-500 dark:text-zinc-400">正解</p>
          <p className="text-2xl font-black text-zinc-950 dark:text-zinc-50">
            {correct}問
          </p>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">全{attempts || 0}回中</p>
        </div>
        <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 dark:border-sky-900 dark:bg-sky-950/50">
          <p className="text-xs font-black tracking-wide text-sky-700 dark:text-sky-300">正答率</p>
          <p className="text-2xl font-black text-zinc-950 dark:text-zinc-50">{accuracy}</p>
          <p className="text-xs font-bold text-sky-700/70">正解した割合</p>
        </div>
        <div className="rounded-lg border px-3 py-2 bn-semantic-warn">
          <p className="text-xs font-black tracking-wide">回答数</p>
          <p className="text-2xl font-black text-zinc-950 dark:text-zinc-50">{attempts}回</p>
          <p className="text-xs font-bold opacity-70">これまでの練習</p>
        </div>
      </div>
    </section>
  );
}
