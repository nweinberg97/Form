import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/dates";
import type { ActivityDay } from "@/server/services/clinician";

const STATUS_TEXT: Record<string, string> = {
  completed: "Completed",
  partial: "Partly done",
  in_progress: "In progress",
  skipped: "Skipped",
  missed: "Not done",
  scheduled: "Scheduled",
  today: "Scheduled today",
  rest: "Rest day",
  before_start: "Before program start",
};

function Cell({ day }: { day: ActivityDay }) {
  const label = `${formatDay(day.date, { weekday: "short", month: "short", day: "numeric" })}: ${STATUS_TEXT[day.status] ?? day.status}${day.isToday ? " (today)" : ""}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "relative flex aspect-square w-full max-w-9 items-center justify-center rounded-[6px]",
        day.isToday && "ring-2 ring-signal ring-offset-2 ring-offset-surface",
      )}
    >
      {day.status === "completed" ? <span className="size-[62%] rounded-[4px] bg-ink" /> : null}
      {day.status === "partial" || day.status === "in_progress" ? (
        <span className="relative size-[62%] overflow-hidden rounded-[4px] border border-ink">
          <span className="absolute inset-y-0 left-0 w-1/2 bg-ink" />
        </span>
      ) : null}
      {day.status === "skipped" || day.status === "missed" ? (
        <span className="size-[62%] rounded-[4px] border border-line-strong" />
      ) : null}
      {day.status === "scheduled" || day.status === "today" ? (
        <span className="size-[62%] rounded-[4px] border border-dashed border-line-strong" />
      ) : null}
      {day.status === "rest" || day.status === "before_start" ? <span className="size-1 rounded-full bg-line" /> : null}
    </span>
  );
}

export function ActivityGrid({ weeks }: { weeks: ActivityDay[][] }) {
  const headers = weeks[0]?.map((d) => d.label) ?? [];
  const all = weeks.flat();
  const done = all.filter((d) => d.status === "completed" || d.status === "partial").length;
  const planned = all.filter((d) => !["rest", "before_start", "scheduled"].includes(d.status)).length;
  return (
    <section aria-labelledby="activity-title" className="rounded-[14px] border border-line bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="activity-title" className="text-[15px] font-semibold">
          Activity
        </h2>
        <span className="kicker text-muted tabular">
          4 weeks · {done} / {planned} done
        </span>
      </div>
      <div role="group" aria-label="Last four weeks, Monday to Sunday" className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] items-center gap-x-1.5 gap-y-1.5">
        <span />
        {headers.map((h) => (
          <span key={h} aria-hidden className="kicker text-center text-muted">
            {h.slice(0, 1)}
          </span>
        ))}
        {weeks.map((week) => (
          <WeekRow key={week[0].date} week={week} />
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] bg-ink" /> Completed
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="relative size-2.5 overflow-hidden rounded-[3px] border border-ink">
            <span className="absolute inset-y-0 left-0 w-1/2 bg-ink" />
          </span>{" "}
          Partly done
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] border border-line-strong" /> Not done or skipped
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px] border border-dashed border-line-strong" /> Upcoming
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1 rounded-full bg-line-strong" /> Rest
        </li>
      </ul>
    </section>
  );
}

function WeekRow({ week }: { week: ActivityDay[] }) {
  return (
    <>
      <span className="kicker pr-2 text-muted tabular">{formatDay(week[0].date)}</span>
      {week.map((day) => (
        <span key={day.date} className="flex justify-center">
          <Cell day={day} />
        </span>
      ))}
    </>
  );
}
