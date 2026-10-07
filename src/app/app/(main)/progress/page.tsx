import type { Metadata } from "next";
import { requirePatientPage } from "@/server/auth/guards";
import { getProgress } from "@/server/services/patient";
import type { DayStatus } from "@/server/services/plan";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { DayMark, WeekStrip } from "@/components/patient/week-strip";

export const metadata: Metadata = { title: "Progress" };

const HISTORY_STATUS: Partial<Record<DayStatus, string>> = {
  completed: "Completed",
  partial: "Partly done",
  in_progress: "In progress",
  skipped: "Skipped",
  missed: "Missed",
};

export default async function ProgressPage() {
  const user = await requirePatientPage();
  const progress = await getProgress(user);

  if (!progress.hasProgram) {
    return (
      <div>
        <h1 className="text-[2.5rem] leading-[0.95] font-black tracking-[-0.045em]">Progress</h1>
        <EmptyState
          className="mt-8"
          title="Your progress will build here."
          description="Once your physio assigns your plan, every session you complete shows up here — week by week."
          action={
            <ButtonLink href="/app" variant="secondary">
              Back to Today
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const { thisWeek } = progress;
  const maxScheduled = Math.max(1, ...progress.weeks.map((w) => w.scheduled));

  return (
    <div className="flex flex-col">
      <p className="kicker text-muted">Week {progress.weeksIn} of your plan</p>
      <h1 className="mt-3 text-[clamp(3.5rem,16vw,5.5rem)] leading-[0.86] font-black tracking-[-0.055em] tabular">
        {progress.sessionsCompleted}
      </h1>
      <p className="mt-2 text-xl font-semibold tracking-[-0.02em]">
        session{progress.sessionsCompleted === 1 ? "" : "s"} completed
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line">
        <Stat label="This week" value={thisWeek.scheduled > 0 ? `${thisWeek.done} of ${thisWeek.scheduled}` : `${thisWeek.done}`} sub="sessions" />
        <Stat label="Exercises" value={String(progress.exercisesCompleted)} sub="completed in total" />
      </dl>

      <section aria-labelledby="week-title" className="mt-12">
        <h2 id="week-title" className="text-lg font-semibold tracking-[-0.015em]">
          This week
        </h2>
        <WeekStrip days={progress.week} className="mt-5" />
      </section>

      {progress.weeks.length > 1 ? (
        <section aria-labelledby="consistency-title" className="mt-12">
          <h2 id="consistency-title" className="text-lg font-semibold tracking-[-0.015em]">
            Week by week
          </h2>
          <p className="mt-1 text-[15px] text-muted">Sessions done out of sessions scheduled.</p>
          <ol className="mt-5 flex h-44 items-end gap-2" aria-label="Sessions per week">
            {progress.weeks.map((week) => {
              const scheduledPct = (week.scheduled / maxScheduled) * 100;
              const donePct = week.scheduled > 0 ? (week.done / week.scheduled) * 100 : 0;
              return (
                <li key={week.start} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[12px] font-medium text-muted tabular" aria-hidden>
                    {week.scheduled > 0 ? `${week.done}/${week.scheduled}` : "–"}
                  </span>
                  <div
                    aria-hidden
                    className={cn("relative w-full max-w-10 overflow-hidden rounded-[6px] bg-sunken", week.current && "ring-1 ring-ink/20")}
                    style={{ height: `${Math.max(4, scheduledPct)}%` }}
                  >
                    <div
                      className={cn("absolute inset-x-0 bottom-0 rounded-[6px]", week.current ? "bg-signal" : "bg-ink")}
                      style={{ height: `${donePct}%` }}
                    />
                  </div>
                  <span className={cn("kicker whitespace-nowrap", week.current ? "text-ink" : "text-muted")} aria-hidden>
                    {week.current ? "Now" : week.label}
                  </span>
                  <span className="sr-only">
                    {week.current ? "This week" : `Week of ${week.label}`}: {week.done} of {week.scheduled} sessions
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="history-title" className="mt-12">
        <h2 id="history-title" className="text-lg font-semibold tracking-[-0.015em]">
          Session history
        </h2>
        {progress.history.length === 0 ? (
          <p className="mt-3 text-[15px] text-muted">Your completed sessions will be listed here.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {progress.history.map((entry) => {
              const statusText = HISTORY_STATUS[entry.status] ?? "—";
              const minutes = entry.durationSec ? Math.max(1, Math.round(entry.durationSec / 60)) : null;
              return (
                <li key={entry.date} className="flex items-center gap-4 py-3.5">
                  <DayMark status={entry.status} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">
                      {entry.label}
                      {entry.label !== formatDay(entry.date) ? (
                        <span className="ml-2 font-normal text-muted">{formatDay(entry.date)}</span>
                      ) : null}
                    </p>
                    <p className="text-[13px] text-muted">{statusText}</p>
                  </div>
                  <p className="text-right text-[13px] text-muted tabular">
                    {entry.exercises > 0 ? `${entry.exercises} exercise${entry.exercises === 1 ? "" : "s"}` : null}
                    {entry.exercises > 0 && minutes ? <br /> : null}
                    {minutes ? `${minutes} min` : null}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface px-4 py-4">
      <dt className="kicker text-muted">{label}</dt>
      <dd className="mt-1.5">
        <span className="block text-3xl font-black tracking-[-0.04em] tabular">{value}</span>
        <span className="block text-[13px] text-muted">{sub}</span>
      </dd>
    </div>
  );
}
