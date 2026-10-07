"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { ExerciseDemo } from "@/components/exercise/exercise-demo";
import { Badge } from "@/components/ui/badge";
import { formatDosage } from "@/lib/dosage";
import type { LibraryExercise } from "@/server/services/clinician";
import { areaLabel, categoryLabel, DIFFICULTY_WORD, equipmentLabel } from "./model";

export function defaultDosageLabel(e: LibraryExercise) {
  return formatDosage({ sets: e.defaultSets, reps: e.defaultReps, durationSec: e.defaultDurationSec, perSide: e.defaultPerSide });
}

export function exerciseMeta(e: LibraryExercise) {
  const area = e.bodyAreas.map(areaLabel).join(", ");
  const equipment = e.equipment.filter((x) => x !== "none").map(equipmentLabel).join(", ") || "No equipment";
  return `${area} · ${equipment}`;
}

/** Full exercise preview: demo, what it is, how to do it, cues, tags, progressions. */
export function ExercisePreview({
  exercise,
  byId,
  onSelectRelated,
  actions,
  headingLevel = "h2",
  children,
}: {
  exercise: LibraryExercise;
  byId: Map<string, LibraryExercise>;
  onSelectRelated?: (id: string) => void;
  actions?: ReactNode;
  headingLevel?: "h2" | "h3";
  children?: ReactNode;
}) {
  const H = headingLevel;
  const Sub = headingLevel === "h2" ? "h3" : "h4";
  const related = (ids: string[]) => ids.map((id) => byId.get(id)).filter((x): x is LibraryExercise => Boolean(x));
  const progressions = related(exercise.progressionIds);
  const regressions = related(exercise.regressionIds);

  return (
    <article className="flex flex-col gap-5">
      <ExerciseDemo
        key={exercise.id}
        name={exercise.name}
        demo={exercise.demo}
        video={exercise.video}
        images={exercise.images}
        attribution={exercise.attribution}
        instructions={exercise.instructions}
      />
      <div>
        <p className="kicker text-muted">{exerciseMeta(exercise)}</p>
        <H className="mt-1.5 text-xl font-semibold tracking-[-0.02em]">{exercise.name}</H>
        <p className="mt-1.5 text-[15px] text-ink/80">{exercise.summary}</p>
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-muted">Default</dt>
            <dd className="tabular font-medium">{defaultDosageLabel(exercise)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Level</dt>
            <dd className="font-medium">{DIFFICULTY_WORD[exercise.difficulty] ?? "—"}</dd>
          </div>
          {exercise.lateralitySupported ? (
            <div className="flex gap-1.5">
              <dt className="text-muted">Sides</dt>
              <dd className="font-medium">One side or both</dd>
            </div>
          ) : null}
        </dl>
      </div>
      {actions}

      {exercise.instructions.length ? (
        <section>
          <Sub className="kicker mb-2 text-muted">How to</Sub>
          <ol className="flex flex-col gap-2">
            {exercise.instructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-snug">
                <span className="kicker mt-0.5 w-5 shrink-0 text-muted tabular">{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {exercise.formCues.length ? (
        <section>
          <Sub className="kicker mb-2 text-muted">Form cues</Sub>
          <ul className="flex flex-col gap-1.5">
            {exercise.formCues.map((cue, i) => (
              <li key={i} className="flex gap-2.5 text-[15px]">
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-ink" />
                {cue}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {exercise.feel ? (
        <section>
          <Sub className="kicker mb-1.5 text-muted">Should feel</Sub>
          <p className="text-[15px]">{exercise.feel}</p>
        </section>
      ) : null}

      {exercise.commonMistakes.length ? (
        <section>
          <Sub className="kicker mb-1.5 text-muted">Common mistakes</Sub>
          <ul className="flex flex-col gap-1 text-[15px] text-ink/80">
            {exercise.commonMistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {exercise.safetyNotes ? (
        <p className="rounded-[10px] bg-sunken px-3.5 py-2.5 text-sm text-ink/80">{exercise.safetyNotes}</p>
      ) : null}

      {progressions.length || regressions.length ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {regressions.length ? (
            <div>
              <Sub className="kicker mb-2 inline-flex items-center gap-1 text-muted">
                <ArrowDownRight aria-hidden className="size-3.5" /> Easier
              </Sub>
              <RelatedList items={regressions} onSelect={onSelectRelated} />
            </div>
          ) : null}
          {progressions.length ? (
            <div>
              <Sub className="kicker mb-2 inline-flex items-center gap-1 text-muted">
                <ArrowUpRight aria-hidden className="size-3.5" /> Harder
              </Sub>
              <RelatedList items={progressions} onSelect={onSelectRelated} />
            </div>
          ) : null}
        </section>
      ) : null}

      {exercise.tags.length || exercise.categories.length ? (
        <section>
          <Sub className="kicker mb-2 text-muted">Tags</Sub>
          <ul className="flex flex-wrap gap-1.5">
            {exercise.categories.map((c) => (
              <li key={`c-${c}`}>
                <Badge tone="dark">{categoryLabel(c)}</Badge>
              </li>
            ))}
            {exercise.tags.map((t) => (
              <li key={t}>
                <Badge tone="outline">{t}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {children}
    </article>
  );
}

function RelatedList({ items, onSelect }: { items: LibraryExercise[]; onSelect?: (id: string) => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((e) => (
        <li key={e.id}>
          {onSelect ? (
            <button
              type="button"
              onClick={() => onSelect(e.id)}
              className="w-full rounded-md border border-line px-3 py-2 text-left text-sm font-medium transition-colors hover:border-ink"
            >
              {e.name}
              <span className="sr-only"> — preview</span>
            </button>
          ) : (
            <span className="block rounded-md border border-line px-3 py-2 text-sm font-medium">{e.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
