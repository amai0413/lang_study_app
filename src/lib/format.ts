/** 学習記録の表示で共通に使う整形関数。 */
export function formatDate(iso: string): string {
  if (!iso) return "未記録";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "未記録";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function percent(correct: number, attempts: number): string {
  if (attempts === 0) return "-";
  return `${Math.round((correct / attempts) * 100)}%`;
}
