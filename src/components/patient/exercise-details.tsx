import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ExerciseSummary } from "@/server/services/plan";

/** "From Marina" — the clinician's own words, visually distinct from general instruction. */
export function PhysioNote({
  note,
  clinicianFirstName,
  className,
}: {
  note: string;
  clinicianFirstName: string | null;
  className?: string;
}) {
  return (
    <figure className={cn("rounded-r-[12px] border-l-[3px] border-ink bg-surface py-4 pr-5 pl-4", className)}>
      <figcaption className="kicker text-muted">From {clinicianFirstName ?? "your physio"}</figcaption>
      <blockquote className="mt-1.5 text-[17px] leading-relaxed text-ink">{note}</blockquote>
    </figure>
  );
}

/**
 * General exercise instruction in the order the patient needs it:
 * what to do → form → what it should feel like → the physio's note → safety.
 */
export function ExerciseDetails({
  exercise,
  note,
  clinicianFirstName,
  headingLevel = "h2",
}: {
  exercise: ExerciseSummary;
  note: string | null;
  clinicianFirstName: string | null;
  headingLevel?: "h2" | "h3";
}) {
  const H = headingLevel;
  return (
    <div className="flex flex-col gap-7">
      {note ? <PhysioNote note={note} clinicianFirstName={clinicianFirstName} /> : null}

      {exercise.instructions.length ? (
        <section>
          <H className="kicker text-muted">How to do it</H>
          <ol className="mt-3 flex flex-col gap-3">
            {exercise.instructions.map((step, i) => (
              <li key={i} className="flex gap-3.5 text-[17px] leading-snug">
                <span aria-hidden className="mt-0.5 w-6 shrink-0 font-mono text-[13px] text-muted tabular">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {exercise.formCues.length ? (
        <section>
          <H className="kicker text-muted">Form</H>
          <ul className="mt-3 flex flex-col gap-2.5">
            {exercise.formCues.map((cue, i) => (
              <li key={i} className="flex gap-3 text-[17px] leading-snug">
                <span aria-hidden className="mt-[0.6em] h-[2px] w-3 shrink-0 bg-ink" />
                <span>{cue}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {exercise.feel ? (
        <section>
          <H className="kicker text-muted">What it should feel like</H>
          <p className="mt-3 text-[17px] leading-relaxed">{exercise.feel}</p>
        </section>
      ) : null}

      {exercise.safetyNotes ? (
        <details className="group rounded-[12px] border border-line">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
            If something doesn&apos;t feel right
            <ChevronDown aria-hidden className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 text-[15px] leading-relaxed text-ink/80">
            <p>{exercise.safetyNotes}</p>
            <p className="mt-2 text-muted">
              You can stop at any time. Tell {clinicianFirstName ?? "your physio"} how it felt after you finish.
            </p>
          </div>
        </details>
      ) : null}
    </div>
  );
}
