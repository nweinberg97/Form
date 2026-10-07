import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { requirePatientPage } from "@/server/auth/guards";
import type { TodayItem, TodayView } from "@/server/services/patient";
import { formatDosage } from "@/lib/dosage";
import { formatDay } from "@/lib/dates";
import { SKIP_REASON_LABEL, type SkipReasonKey } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { DemoThumb } from "@/components/exercise/exercise-demo";
import { StepProgress } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { WeekStrip } from "@/components/patient/week-strip";
import {
  MissedCard,
  PlanUpdateBanner,
  QuietLink,
  SkipToday,
  StartButton,
  StickyAction,
} from "@/components/patient/today-actions";
import { getTodayCached } from "../_lib/today";

export default async function TodayPage() {
  const user = await requirePatientPage();
  if (!user.onboardedAt) redirect("/app/onboarding");
  const view = await getTodayCached(user);
  const clinician = view.clinician?.firstName ?? null;
  const showWeek = !["no_program", "discharged", "future"].includes(view.state) && view.weekScheduled > 0;
  const hasSticky = ["not_started", "in_progress"].includes(view.state);

  return (
    <div className="flex flex-col">
      <p className="text-[15px] font-medium text-muted">
        {view.greeting}, {view.firstName}
      </p>

      <div className="mt-2">
        <TodayHero view={view} clinician={clinician} />
      </div>

      {view.update && view.state !== "discharged" ? (
        <div className="mt-8">
          <PlanUpdateBanner id={view.update.id} body={view.update.body} />
        </div>
      ) : null}

      {view.pendingMissed && !["no_program", "discharged"].includes(view.state) ? (
        <div className="mt-8">
          <MissedCard date={view.pendingMissed.date} label={view.pendingMissed.label} clinicianFirstName={clinician} />
        </div>
      ) : null}

      {showWeek ? (
        <section id="week" aria-labelledby="week-title" className="mt-12 scroll-mt-24">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="week-title" className="text-lg font-semibold tracking-[-0.015em]">
              This week
            </h2>
            <p className="text-[15px] text-muted tabular">
              {view.weekDone} of {view.weekScheduled} sessions completed
            </p>
          </div>
          <WeekStrip days={view.week} className="mt-5" />
        </section>
      ) : null}

      {hasSticky ? <div aria-hidden className="h-24 md:hidden" /> : null}
    </div>
  );
}

function Headline({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={cn("text-[2.5rem] leading-[0.95] font-black tracking-[-0.045em] text-balance sm:text-5xl", className)}>
      {children}
    </h1>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[17px] text-muted tabular">{children}</p>;
}

function exercisesLabel(n: number) {
  return `${n} exercise${n === 1 ? "" : "s"}`;
}

function NextLine({ view }: { view: TodayView }) {
  if (!view.next) return null;
  return (
    <p className="text-[15px] text-muted tabular">
      Next session: <span className="font-medium text-ink">{view.next.label}</span> · {exercisesLabel(view.next.count)}
    </p>
  );
}

function TodayHero({ view, clinician }: { view: TodayView; clinician: string | null }) {
  const physio = clinician ?? "your physio";
  switch (view.state) {
    case "not_started":
      return (
        <section aria-labelledby="today-title">
          <Headline>
            <span id="today-title">Today&apos;s rehabilitation</span>
          </Headline>
          <Meta>
            {exercisesLabel(view.totalCount)} · about {view.minutes} min
          </Meta>
          <ExerciseList items={view.items} multiplePrograms={view.multiplePrograms} className="mt-7" />
          <div className="mt-8 flex flex-col gap-4">
            <StickyAction>
              <StartButton>Start today&apos;s session</StartButton>
            </StickyAction>
            <NextLine view={view} />
            <div>
              <SkipToday date={view.today} clinicianFirstName={clinician} />
            </div>
          </div>
        </section>
      );

    case "in_progress": {
      const remaining = view.totalCount - view.doneCount;
      return (
        <section aria-labelledby="today-title">
          <Headline>
            <span id="today-title">Continue today&apos;s session</span>
          </Headline>
          <Meta>
            {view.doneCount} of {view.totalCount} exercises complete · {remaining} remaining, about {view.remainingMinutes} min
          </Meta>
          <StepProgress
            total={view.totalCount}
            done={view.doneCount}
            current={view.doneCount}
            label={`${view.doneCount} of ${view.totalCount} exercises complete`}
            className="mt-5"
          />
          <ExerciseList items={view.items} multiplePrograms={view.multiplePrograms} className="mt-7" />
          <div className="mt-8 flex flex-col gap-4">
            <StickyAction>
              <ButtonLink href="/app/session" variant="primary" size="xl" block>
                Continue
              </ButtonLink>
            </StickyAction>
            <div>
              <SkipToday date={view.today} clinicianFirstName={clinician} />
            </div>
          </div>
        </section>
      );
    }

    case "complete": {
      const minutes = view.durationSec ? Math.max(1, Math.round(view.durationSec / 60)) : null;
      return (
        <section aria-labelledby="today-title" className="relative">
          <div className="overflow-hidden rounded-[20px] bg-ink p-6 text-paper on-dark form-grid">
            <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-signal text-ink">
              <Check className="size-6" strokeWidth={3} />
            </span>
            <h1 id="today-title" className="mt-8 text-[2.25rem] leading-[0.95] font-black tracking-[-0.045em] sm:text-5xl">
              Today&apos;s rehabilitation complete.
            </h1>
            <p className="mt-3 text-[17px] text-paper/80">Nice work. You&apos;re done for today.</p>
            <p className="kicker mt-6 text-night-muted tabular">
              {view.doneCount} of {view.totalCount} exercises{minutes ? ` · ${minutes} min` : ""}
            </p>
          </div>
          <div className="mt-5">
            <NextLine view={view} />
          </div>
          <ExerciseList items={view.items} multiplePrograms={view.multiplePrograms} className="mt-7" compact />
        </section>
      );
    }

    case "partial":
      return (
        <section aria-labelledby="today-title">
          <Headline>
            <span id="today-title">
              You did {view.doneCount} of {view.totalCount} today.
            </span>
          </Headline>
          <Meta>What you did counts. If you have a few minutes, you can finish the rest.</Meta>
          <ExerciseList items={view.items} multiplePrograms={view.multiplePrograms} className="mt-7" />
          <div className="mt-8 flex flex-col gap-4">
            <StartButton variant="dark" size="lg">
              Finish the rest
            </StartButton>
            <NextLine view={view} />
          </div>
        </section>
      );

    case "skipped": {
      // getToday may expose the recorded reason as `skipReason`; until it does, the copy reads fine without it.
      const reason = "skipReason" in view ? ((view as { skipReason?: SkipReasonKey | null }).skipReason ?? null) : null;
      return (
        <section aria-labelledby="today-title">
          <Headline>
            <span id="today-title">Today&apos;s session skipped</span>
          </Headline>
          <Meta>
            {reason ? `${SKIP_REASON_LABEL[reason]}. ` : ""}Thanks for letting {physio} know.
          </Meta>
          <div className="mt-8 flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[15px] font-medium">Changed your mind?</p>
              <StartButton variant="secondary" size="lg">
                Start anyway
              </StartButton>
            </div>
            <NextLine view={view} />
          </div>
        </section>
      );
    }

    case "rest":
      return (
        <section aria-labelledby="today-title">
          <Headline>
            <span id="today-title">Rest day.</span>
          </Headline>
          <Meta>Nothing prescribed for today.</Meta>
          <div className="mt-6 flex flex-col gap-2">
            <NextLine view={view} />
            <div>
              <QuietLink href="#week">View your week</QuietLink>
            </div>
          </div>
        </section>
      );

    case "future":
      return (
        <section aria-labelledby="today-title">
          <Headline>
            <span id="today-title">
              Your plan starts {view.futureStart ? startLabel(view.futureStart.label, view.futureStart.date) : "soon"}.
            </span>
          </Headline>
          <Meta>
            {physio.charAt(0).toUpperCase() + physio.slice(1)} has set it up. Here&apos;s what&apos;s coming
            {view.next ? ` — ${exercisesLabel(view.next.count)}, about ${view.next.minutes} min.` : "."}
          </Meta>
          <div className="mt-7">
            <ButtonLink href="/app/program" variant="secondary" size="lg" block>
              Preview your plan
            </ButtonLink>
          </div>
        </section>
      );

    case "discharged":
      return (
        <section aria-labelledby="today-title">
          <Headline>
            <span id="today-title">Your plan has ended.</span>
          </Headline>
          <Meta>
            You&apos;ve finished your rehabilitation with {physio}. Your history stays here, and you can still read your
            messages.
          </Meta>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <ButtonLink href="/app/progress" variant="secondary" size="lg">
              View your progress
            </ButtonLink>
            <ButtonLink href="/app/messages" variant="ghost" size="lg">
              Messages
            </ButtonLink>
          </div>
        </section>
      );

    case "no_program":
    default:
      return (
        <section aria-labelledby="today-title">
          <Headline>
            <span id="today-title">Your plan will appear here.</span>
          </Headline>
          <Meta>When {physio} assigns your exercises, you&apos;ll see exactly what to do each day.</Meta>
          <div className="mt-7">
            <ButtonLink href="/app/messages" variant="secondary" size="lg">
              Message {physio}
            </ButtonLink>
          </div>
        </section>
      );
  }
}

function startLabel(label: string, date: string) {
  if (label === "Today" || label === "Tomorrow") return label.toLowerCase();
  if (/^[A-Z][a-z]+day$/.test(label)) return label;
  return `on ${formatDay(date, { weekday: "long", month: "short", day: "numeric" })}`;
}

function ExerciseList({
  items,
  multiplePrograms,
  className,
  compact,
}: {
  items: TodayItem[];
  multiplePrograms: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <ol className={cn("divide-y divide-line border-y border-line", className)}>
      {items.map((item, i) => (
        <li key={item.programExerciseId} className={cn("flex items-center gap-4", compact ? "py-3" : "py-4")}>
          <span
            aria-hidden
            className={cn("w-6 shrink-0 font-mono text-[13px] tabular", item.done ? "text-faint" : "text-muted")}
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-[17px] font-semibold tracking-[-0.015em]",
                item.done && "text-muted line-through decoration-line-strong",
              )}
            >
              {item.exercise.name}
            </p>
            {multiplePrograms ? <p className="truncate text-[13px] text-muted">{item.programTitle}</p> : null}
            <p className="text-[15px] text-muted tabular">
              {formatDosage(item)}
              {item.done ? <span className="sr-only">, done</span> : null}
            </p>
          </div>
          {item.done ? (
            <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
              <Check className="size-4" strokeWidth={3} />
            </span>
          ) : compact ? null : (
            <span aria-hidden className="w-[72px] shrink-0">
              <DemoThumb demo={item.exercise.demo} label={`${item.exercise.name} demonstration`} />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
