import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { requirePatientPage } from "@/server/auth/guards";
import { firstName, getProgramView } from "@/server/services/patient";
import { formatDay, formatDays } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { ProgramExerciseList } from "@/components/patient/program/exercise-list";
import { AddToCalendar } from "@/components/patient/program/add-to-calendar";
import { getTodayCached } from "../../_lib/today";

export const metadata: Metadata = { title: "Program" };

export default async function ProgramPage() {
  const user = await requirePatientPage();
  const [view, today] = await Promise.all([getProgramView(user), getTodayCached(user)]);

  if (view.programs.length === 0) {
    return (
      <div>
        <h1 className="text-[2.5rem] leading-[0.95] font-black tracking-[-0.045em]">Program</h1>
        <EmptyState
          className="mt-8"
          title="No plan yet."
          description={`When ${today.clinician?.firstName ?? "your physio"} assigns your exercises, your full schedule and every exercise will be here.`}
          action={
            <ButtonLink href="/app/messages" variant="secondary">
              Message {today.clinician?.firstName ?? "your physio"}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const nextSession =
    (today.state === "not_started" || today.state === "in_progress") && today.totalCount > 0
      ? { date: today.today, label: "Today", count: today.totalCount, minutes: today.minutes }
      : today.next;

  return (
    <div className="flex flex-col gap-14">
      {view.programs.map((program, index) => {
        const Title = index === 0 ? "h1" : "h2";
        const physio = firstName(program.clinicianName);
        const updatedLabel = program.updatedAt
          ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: user.timezone }).format(
              new Date(program.updatedAt),
            )
          : null;
        const programDays = new Set(program.days);
        return (
          <article key={program.id} aria-labelledby={`program-${program.id}`}>
            <p className="kicker text-muted">{program.startsInFuture ? "Starts soon" : "Your plan"}</p>
            <Title
              id={`program-${program.id}`}
              className="mt-2 text-[2.5rem] leading-[0.95] font-black tracking-[-0.045em] text-balance sm:text-5xl"
            >
              {program.title}
            </Title>
            <p className="mt-4 text-[15px] text-ink">
              Prescribed by{" "}
              <span className="font-semibold">
                {program.clinicianName}
                {program.clinicianCredentials ? `, ${program.clinicianCredentials}` : ""}
              </span>
              <span className="text-muted">
                {" "}
                · {program.startsInFuture ? "Starts" : "Started"} {formatDay(program.startDate)}
              </span>
            </p>

            {program.version > 1 && updatedLabel ? (
              <details className="group mt-4 rounded-[12px] border border-line bg-surface" open={program.changeSummary.length <= 3}>
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
                  <span className="text-[15px]">
                    <span className="font-semibold">Updated {updatedLabel}</span>
                    <span className="text-muted"> · v{program.version}</span>
                  </span>
                  {program.changeSummary.length ? (
                    <span className="inline-flex items-center gap-1 text-[13px] font-medium text-muted">
                      What changed
                      <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
                    </span>
                  ) : null}
                </summary>
                {program.changeSummary.length ? (
                  <ul className="flex flex-col gap-2 px-4 pb-4">
                    {program.changeSummary.map((line, i) => (
                      <li key={i} className="flex gap-3 text-[15px]">
                        <span aria-hidden className="mt-[0.6em] h-[2px] w-3 shrink-0 bg-signal" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            ) : null}

            {program.note ? (
              <figure className="mt-6 rounded-r-[12px] border-l-[3px] border-ink bg-surface py-4 pr-5 pl-4">
                <figcaption className="kicker text-muted">From {physio}</figcaption>
                <blockquote className="mt-1.5 text-[17px] leading-relaxed">{program.note}</blockquote>
              </figure>
            ) : null}

            <section aria-labelledby={`schedule-${program.id}`} className="mt-10">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id={`schedule-${program.id}`} className="text-lg font-semibold tracking-[-0.015em]">
                  Schedule
                </h2>
                <p className="text-[15px] text-muted">{formatDays(program.days)}</p>
              </div>
              <ol className="mt-4 grid grid-cols-7 gap-1.5">
                {view.week.map((day) => {
                  const count = day.items.filter((i) => i.programId === program.id).length;
                  const has = count > 0;
                  return (
                    <li
                      key={day.date}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-[10px] py-2.5",
                        has ? "bg-ink text-paper" : "bg-sunken text-muted",
                        day.isToday && "ring-2 ring-signal ring-offset-2 ring-offset-paper",
                      )}
                    >
                      <span className="kicker">{day.label.slice(0, 3)}</span>
                      <span className="text-[15px] font-semibold tabular" aria-hidden>
                        {has ? count : "–"}
                      </span>
                      <span className="sr-only">
                        {day.isToday ? "Today, " : ""}
                        {has ? `${count} exercise${count === 1 ? "" : "s"}` : "Rest day"}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[13px] text-muted">Number of exercises each day this week.</p>
            </section>

            <section aria-labelledby={`exercises-${program.id}`} className="mt-10">
              <h2 id={`exercises-${program.id}`} className="text-lg font-semibold tracking-[-0.015em]">
                Exercises <span className="font-normal text-muted tabular">· {program.items.length}</span>
              </h2>
              <div className="mt-4">
                <ProgramExerciseList items={program.items} programDays={[...programDays]} clinicianFirstName={physio} />
              </div>
            </section>
          </article>
        );
      })}

      {nextSession ? (
        <AddToCalendar
          date={nextSession.date}
          label={nextSession.label}
          count={nextSession.count}
          minutes={nextSession.minutes}
        />
      ) : null}
    </div>
  );
}
