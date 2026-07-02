import type { LearningProgress } from "@/lib/progress";

interface ProgressMeterProps {
  progress: LearningProgress | null;
}

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function ProgressMeter({ progress }: ProgressMeterProps) {
  const level = progress?.level ?? "A1";
  const score = progress?.score ?? 0;
  const readiness = progress?.readiness ?? 0;
  const accuracy = progress?.attempts ? percentage(progress.accuracy) : "--";
  const attempts = progress?.attempts ?? 0;

  return (
    <div className="grid gap-3 rounded-lg border border-emerald-100 bg-white/85 p-3 shadow-sm shadow-emerald-100/60 sm:grid-cols-[auto_minmax(180px,1fr)_auto] sm:items-center">
      <div className="flex items-center gap-2">
        <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-500 text-base font-black text-white shadow-sm">
          {level}
        </div>
        <div>
          <p className="text-xs font-bold text-emerald-700">現在のレベル</p>
          <p className="text-sm font-black text-zinc-900">Score {score}/1000</p>
        </div>
      </div>

      <div className="min-w-0">
        <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-400 transition-[width] duration-700 ease-out"
            style={{ width: `${readiness}%` }}
          />
        </div>
        <p className="mt-1 text-xs font-semibold text-zinc-500">次のレベルまで {readiness}%</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center sm:min-w-32">
        <div className="rounded-lg bg-sky-50 px-2 py-1.5">
          <p className="text-[10px] font-bold uppercase text-sky-600">Accuracy</p>
          <p className="text-sm font-black text-zinc-900">{accuracy}</p>
        </div>
        <div className="rounded-lg bg-amber-50 px-2 py-1.5">
          <p className="text-[10px] font-bold uppercase text-amber-600">Tries</p>
          <p className="text-sm font-black text-zinc-900">{attempts}</p>
        </div>
      </div>
    </div>
  );
}
