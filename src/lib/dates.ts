/**
 * Calendar-day helpers. Rehabilitation happens on the patient's calendar,
 * so dates are ISO strings ("2026-10-07") interpreted in the patient's timezone.
 */

export type ISODate = string;

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
/** Monday-first display order of weekday numbers. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Hour of day (0–23) in a timezone — for greetings. */
export function hourIn(timeZone: string, now: Date = new Date()) {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
}

const toUTC = (iso: ISODate) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (date: Date): ISODate => date.toISOString().slice(0, 10);

export function addDays(iso: ISODate, days: number): ISODate {
  const date = toUTC(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTC(date);
}

export function weekday(iso: ISODate) {
  return toUTC(iso).getUTCDay();
}

export function diffDays(a: ISODate, b: ISODate) {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86_400_000);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: ISODate): ISODate {
  const day = weekday(iso);
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

export function weekDates(iso: ISODate): ISODate[] {
  const monday = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatDay(iso: ISODate, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(toUTC(iso));
}

/** "Today", "Yesterday", "Tomorrow", "Monday", or "Oct 2". */
export function relativeDay(iso: ISODate, today: ISODate) {
  const delta = diffDays(iso, today);
  if (delta === 0) return "Today";
  if (delta === -1) return "Yesterday";
  if (delta === 1) return "Tomorrow";
  if (delta > 1 && delta < 7) return WEEKDAYS_LONG[weekday(iso)];
  if (delta < 0 && delta > -7) return WEEKDAYS_LONG[weekday(iso)];
  return formatDay(iso);
}

export function formatDays(days: readonly number[]) {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "Weekdays";
  return WEEK_ORDER.filter((d) => set.has(d))
    .map((d) => WEEKDAYS_SHORT[d])
    .join(" / ");
}

/** Relative time for timestamps: "just now", "3h ago", "Yesterday", "Oct 2". */
export function timeAgo(date: Date | string, now: Date = new Date()) {
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(then);
}

export function greeting(hour: number) {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** ISO-8601 week key, e.g. "2026-W41". */
export function isoWeekKey(iso: ISODate) {
  const date = toUTC(iso);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The UTC instant for a wall-clock time on a date in a timezone. */
export function zonedTime(iso: ISODate, hour: number, minute: number, timeZone: string) {
  const tz = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const [y, m, d] = iso.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const asIfUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (asIfUTC - guess));
}
