import { formatDate, percent } from "@/lib/format";
import { LANGUAGE_LABELS } from "@/lib/languages";
import { speechLanguageFor } from "@/lib/speech";
import { findWordRecord } from "@/lib/wordStore";
import type { TargetLanguage } from "@/types/question";
import SpeakButton from "@/components/SpeakButton";

export type WordCardStatus = "remembered" | "review" | "unknown";

const STATUS_STYLE: Record<WordCardStatus, { label: string; card: string; badge: string }> = {
  remembered: {
    label: "記憶済み",
    card: "bn-semantic-good-strong",
    badge: "bn-semantic-badge bn-text-good",
  },
  review: {
    label: "復習",
    card: "bn-semantic-warn-strong",
    badge: "bn-semantic-badge bn-text-warn",
  },
  unknown: {
    label: "確認",
    card: "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50",
    badge: "bn-semantic-badge text-zinc-500 dark:text-zinc-400",
  },
};

export function wordReadingLabel(lang?: TargetLanguage): string {
  if (lang === "zh") return "拼音";
  return lang === "es" ? "英語の意味" : "読み";
}

/**
 * 単語1つを表示する共通カード。どの画面でも同じ見た目・同じ情報になるよう、
 * 学習記録（正答率・出現回数・最終・音声）はカード自身が単語DBから引いて表示する。
 * 画面側は surface/status/language を渡すだけでよく、画面ごとの配線ズレが起きない。
 */
export default function WordCard({
  surface,
  reading,
  meaning,
  pos,
  note,
  status,
  language,
}: {
  surface: string;
  reading?: string;
  meaning?: string;
  pos?: string;
  note?: string;
  status: WordCardStatus;
  language?: TargetLanguage;
}) {
  const style = STATUS_STYLE[status];
  const record = language ? findWordRecord(language, surface) : undefined;

  return (
    <article className={`flex flex-col gap-3 rounded-lg border p-4 shadow-sm ${style.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {language ? <p className="text-xs font-black opacity-65">{LANGUAGE_LABELS[language]}</p> : null}
          <h2 className="mt-0.5 break-words text-2xl font-black leading-tight sm:text-3xl">{surface}</h2>
          {reading ? (
            <p className="mt-1 break-words text-sm font-black opacity-75">
              {wordReadingLabel(language)}: {reading}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${style.badge}`}>{style.label}</span>
          {language ? (
            <SpeakButton text={surface} lang={speechLanguageFor(language)} label="音声" purpose="word" />
          ) : null}
        </div>
      </div>

      {meaning ? (
        <p className="break-words rounded-lg bg-white/85 p-3 text-lg font-black text-zinc-900 shadow-sm dark:bg-zinc-950/25 dark:text-zinc-50">
          {meaning}
        </p>
      ) : null}

      {note ? (
        <p className="break-words border-l-2 border-current pl-3 text-sm font-bold leading-relaxed opacity-85">
          {note}
        </p>
      ) : null}

      {pos || record ? (
        <div className="flex flex-wrap gap-2 text-sm font-bold opacity-80">
          {pos ? (
            <span className="rounded-full bg-white/45 px-2.5 py-1 dark:bg-zinc-950/20">品詞: {pos}</span>
          ) : null}
          {record ? (
            <>
              <span className="rounded-full bg-white/45 px-2.5 py-1 dark:bg-zinc-950/20">
                正答率 {percent(record.correctCount, record.seenCount)}
              </span>
              <span className="rounded-full bg-white/45 px-2.5 py-1 dark:bg-zinc-950/20">
                出現 {record.seenCount}回
              </span>
              <span className="rounded-full bg-white/45 px-2.5 py-1 dark:bg-zinc-950/20">
                最終 {formatDate(record.lastSeen)}
              </span>
              <span className="rounded-full bg-white/45 px-2.5 py-1 dark:bg-zinc-950/20">
                音声 {record.audio?.audioUrl ? "あり" : record.audioStatus === "failed" ? "失敗" : "未生成"}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
