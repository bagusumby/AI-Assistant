// Timestamps are stored in UTC (Postgres TIMESTAMPTZ) — always render them in WIB (Asia/Jakarta)
// regardless of the viewer's device/browser timezone.
const WIB_TIMEZONE = "Asia/Jakarta";

export function formatDateTime(
  iso: string | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
) {
  return new Date(iso).toLocaleString("id-ID", { ...options, timeZone: WIB_TIMEZONE });
}

export function formatDate(
  iso: string | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }
) {
  return new Date(iso).toLocaleDateString("id-ID", { ...options, timeZone: WIB_TIMEZONE });
}

export function formatTime(
  iso: string | Date,
  options: Intl.DateTimeFormatOptions = { timeStyle: "short" }
) {
  return new Date(iso).toLocaleTimeString("id-ID", { ...options, timeZone: WIB_TIMEZONE });
}

const wibPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: WIB_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

// Extracts wall-clock year/month/day/hour in WIB, independent of the server process's own timezone.
export function getWIBParts(iso: string | Date) {
  const parts = Object.fromEntries(wibPartsFormatter.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
  };
}

export function getWIBDateKey(iso: string | Date): string {
  const { year, month, day } = getWIBParts(iso);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getWIBHour(iso: string | Date): number {
  return getWIBParts(iso).hour;
}
