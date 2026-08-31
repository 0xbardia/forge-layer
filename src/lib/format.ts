export function formatWhen(unix: number): string {
  if (!unix) return "—";
  const d = new Date(unix * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(unix: number, now = Date.now() / 1000): string {
  const diff = unix - now;
  const abs = Math.abs(diff);
  const past = diff < 0;
  const fmt = (n: number, unit: string) =>
    `${Math.round(n)} ${unit}${Math.round(n) === 1 ? "" : "s"} ${past ? "ago" : "left"}`;
  if (abs < 60) return fmt(abs, "second");
  if (abs < 3600) return fmt(abs / 60, "minute");
  if (abs < 86400) return fmt(abs / 3600, "hour");
  return fmt(abs / 86400, "day");
}
