export function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 日付文字列(YYYY-MM-DD)をその日の開始時刻のISO文字列に変換する */
export function startOfDayISO(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString();
}

/** 日付文字列(YYYY-MM-DD)をその日の終了時刻のISO文字列に変換する */
export function endOfDayISO(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

/** 日付文字列(YYYY-MM-DD)に日数を加算した日付文字列を返す */
export function addDaysToDateString(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateJa(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));
}
