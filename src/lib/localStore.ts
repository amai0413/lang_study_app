/** localStorage の JSON 読み書きでどのストアも書いていた定型処理（SSRガード・JSON.parse失敗時の既定値）をまとめる。 */
export function readLocalStorageJSON<T>(
  key: string,
  fallback: T,
  isValid?: (value: unknown) => boolean,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (isValid && !isValid(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeLocalStorageJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}
