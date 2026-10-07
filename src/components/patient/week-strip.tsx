import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DayStatus } from "@/server/services/plan";

export type WeekStripDay = { date: string; label: string; status: DayStatus; isToday: boolean };

const STATUS_TEXT: Record<DayStatus, string> = {
  completed: "Done",
  partial: "Partly done",
  in_progress: "In progress",
  skipped: "Skipped",
  missed: "Missed",
  scheduled: "Upcoming",
  today: "Today",
  rest: "Rest day",
  before_start: "Before your plan started",
};

/**
 * The week at a glance. Neutral by design: done is ink, today is Signal,
 * missed is an empty ring — never red, never a streak.
 */
export function WeekStrip({ days, className }: { days: WeekStripDay[]; className?: string }) {
  return (
    <ol className={cn("grid grid-cols-7 gap-1", className)}>
      {days.map((day) => (
        <li key={day.date} className="flex flex-col items-center gap-2">
          <span className={cn("kicker", day.isToday ? "font-semibold text-ink" : "text-muted")}>{day.label.slice(0, 3)}</span>
          <DayMark status={day.status} isToday={day.isToday} />
          <span className="sr-only">
            {day.isToday ? "Today, " : ""}
            {STATUS_TEXT[day.status]}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function DayMark({ status, isToday, size = "md" }: { status: DayStatus; isToday?: boolean; size?: "sm" | "md" }) {
  const box = size === "md" ? "size-9" : "size-7";
  const common = cn("relative inline-flex shrink-0 items-center justify-center rounded-full", box);
  switch (status) {
    case "completed":
      return (
        <span aria-hidden className={cn(common, "bg-ink text-paper")}>
          <Check className={size === "md" ? "size-4" : "size-3.5"} strokeWidth={3} />
        </span>
      );
    case "partial":
      return (
        <span aria-hidden className={cn(common, "overflow-hidden border-2 border-ink")}>
          <span className="absolute inset-y-0 left-0 w-1/2 bg-ink" />
        </span>
      );
    case "in_progress":
    case "today":
      return (
        <span aria-hidden className={cn(common, "border-2 border-signal")}>
          <span className={cn("rounded-full bg-signal", size === "md" ? "size-3" : "size-2.5")} />
        </span>
      );
    case "scheduled":
      return <span aria-hidden className={cn(common, "border-2 border-line-strong")} />;
    case "missed":
      return <span aria-hidden className={cn(common, "border-2 border-dashed border-line-strong")} />;
    case "skipped":
      return (
        <span aria-hidden className={cn(common, "border-2 border-line-strong text-muted")}>
          <span className="h-0.5 w-3 rounded-full bg-current" />
        </span>
      );
    default:
      // rest / before_start
      return (
        <span aria-hidden className={cn(common, isToday ? "border-2 border-ink/30" : "")}>
          <span className="h-0.5 w-2.5 rounded-full bg-line-strong" />
        </span>
      );
  }
}

/** Legend in words so no meaning lives in shape alone. */
export function WeekLegend({ className }: { className?: string }) {
  const entries: { status: DayStatus; label: string }[] = [
    { status: "completed", label: "Done" },
    { status: "partial", label: "Partly done" },
    { status: "today", label: "Today" },
    { status: "scheduled", label: "Upcoming" },
    { status: "rest", label: "Rest" },
  ];
  return (
    <ul aria-hidden className={cn("flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted", className)}>
      {entries.map((e) => (
        <li key={e.status} className="inline-flex items-center gap-1.5">
          <DayMark status={e.status} size="sm" />
          {e.label}
        </li>
      ))}
    </ul>
  );
}
