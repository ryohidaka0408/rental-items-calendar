export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

export function formatDateTimeJa(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatRelativeDeadline(iso: string, now: Date = new Date()): string {
  const diffMinutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);

  if (diffMinutes <= 0) {
    const overdueMinutes = Math.abs(diffMinutes);
    if (overdueMinutes < 60) return `期限超過(${overdueMinutes}分超過)`;
    return `期限超過(${Math.round(overdueMinutes / 60)}時間超過)`;
  }
  if (diffMinutes < 60) return `あと${diffMinutes}分`;
  return `あと${Math.round(diffMinutes / 60)}時間`;
}
