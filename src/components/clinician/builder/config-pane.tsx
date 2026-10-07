"use client";

import { useId, useState } from "react";
import { ChevronDown, Eye } from "lucide-react";
import { Segmented, Textarea, Toggle } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatDays } from "@/lib/dates";
import { formatDosage, SIDE_LABEL } from "@/lib/dosage";
import type { LibraryExercise } from "@/server/services/clinician";
import { DayToggles, Stepper } from "./controls";
import { LIMITS, subsetDays, type BuilderItem } from "./model";

/** 5 s steps up to a minute, then 15 s up to three minutes, then 30 s. */
const durationStep = (value: number, dir: 1 | -1) => {
  const ref = dir > 0 ? value : value - 1;
  const step = ref < 60 ? 5 : ref < 180 ? 15 : 30;
  return value + dir * step;
};

export function ConfigPane({
  item,
  exercise,
  programDays,
  patientFirstName,
  clinicianFirstName,
  index,
  error,
  firstFieldRef,
  onChange,
  onApplyDaysToAll,
  onPreview,
}: {
  item: BuilderItem | null;
  exercise: LibraryExercise | undefined;
  programDays: number[];
  patientFirstName: string | null;
  clinicianFirstName: string;
  index: number;
  error?: string;
  firstFieldRef: React.RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<BuilderItem>) => void;
  onApplyDaysToAll: (days: number[] | null) => void;
  onPreview: (exerciseId: string) => void;
}) {
  const moreId = useId();
  const hasMore = Boolean(item && (item.side !== "both" || (item.days && item.days.length) || item.note?.trim()));
  const [moreOpen, setMoreOpen] = useState(hasMore);
  const [openFor, setOpenFor] = useState<string | null>(item?.key ?? null);
  if (item && openFor !== item.key) {
    setOpenFor(item.key);
    setMoreOpen(hasMore);
  }

  if (!item || !exercise) {
    return (
      <div className="flex flex-col gap-2 px-5 py-6">
        <p className="kicker text-muted">Configure</p>
        <p className="text-[15px] text-muted">Select an exercise in the plan to set its dosage, days and a note.</p>
      </div>
    );
  }

  const timed = item.durationSec !== null;
  const subset = subsetDays(item.days, programDays);
  const daysValue = subset && subset.length ? subset : programDays;

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <div>
        <p className="kicker text-muted">Configure · {String(index + 1).padStart(2, "0")}</p>
        <h3 className="mt-1 text-lg font-semibold tracking-[-0.015em]">{exercise.name}</h3>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
          <span className="tabular font-medium text-ink" aria-live="polite">
            {formatDosage(item)}
          </span>
          <button type="button" onClick={() => onPreview(exercise.id)} className="inline-flex items-center gap-1 text-muted underline-offset-2 hover:text-ink hover:underline">
            <Eye aria-hidden className="size-3.5" /> Preview
          </button>
        </p>
        {error ? (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>

      <section aria-label="Dosage" className="flex flex-col gap-4">
        <Stepper
          ref={firstFieldRef}
          label="Sets"
          value={item.sets}
          min={LIMITS.sets[0]}
          max={LIMITS.sets[1]}
          onChange={(sets) => onChange({ sets })}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Each set is</span>
          <Segmented
            label="Each set is measured in"
            value={timed ? "time" : "reps"}
            onChange={(v) =>
              v === "time"
                ? onChange({ durationSec: item.durationSec ?? exercise.defaultDurationSec ?? 30, reps: null })
                : onChange({ reps: item.reps ?? exercise.defaultReps ?? 10, durationSec: null })
            }
            options={[
              { value: "reps", label: "Reps" },
              { value: "time", label: "Time" },
            ]}
          />
        </div>
        {timed ? (
          <Stepper
            label="Hold"
            suffix="sec"
            value={item.durationSec ?? 30}
            min={LIMITS.duration[0]}
            max={600}
            step={durationStep}
            onChange={(durationSec) => onChange({ durationSec })}
          />
        ) : (
          <Stepper
            label="Reps"
            value={item.reps ?? 10}
            min={LIMITS.reps[0]}
            max={LIMITS.reps[1]}
            onChange={(reps) => onChange({ reps })}
          />
        )}
        <Toggle
          label="Each side"
          description={item.perSide ? "Dosage is per side" : "Dosage is total"}
          checked={item.perSide}
          onChange={(perSide) => onChange({ perSide })}
        />
      </section>

      <div className="border-t border-line pt-4">
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls={moreId}
          onClick={() => setMoreOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-md py-1 text-left text-sm font-semibold"
        >
          <span>
            More options
            {!moreOpen && hasMore ? (
              <span className="ml-2 font-normal text-muted">
                {[
                  item.side !== "both" ? SIDE_LABEL[item.side] : null,
                  subset?.length ? `${formatDays(subset)} only` : null,
                  item.note?.trim() ? "Note" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
          </span>
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />
        </button>

        {moreOpen ? (
        <div id={moreId} className="mt-4 flex flex-col gap-6">
          {exercise.lateralitySupported ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Side</span>
              <Segmented
                label="Side"
                size="sm"
                value={item.side}
                onChange={(side) => onChange({ side })}
                options={[
                  { value: "both", label: "Both" },
                  { value: "left", label: "Left" },
                  { value: "right", label: "Right" },
                  { value: "alternating", label: "Alternating" },
                ]}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span id={`${moreId}-days`} className="text-sm font-medium">
                Only on certain days
              </span>
              {subset?.length ? (
                <button type="button" onClick={() => onChange({ days: null })} className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
                  Every program day
                </button>
              ) : null}
            </div>
            <DayToggles
              label={`Days for ${exercise.name}`}
              size="sm"
              value={daysValue}
              allowed={programDays}
              onChange={(days) => {
                const valid = days.filter((d) => programDays.includes(d));
                onChange({ days: valid.length === 0 || valid.length >= programDays.length ? null : valid });
              }}
            />
            <p className="text-xs text-muted">
              {subset?.length ? `${formatDays(subset)} only.` : `Every program day (${formatDays(programDays) || "none chosen"}).`}{" "}
              <button
                type="button"
                onClick={() => onApplyDaysToAll(subset?.length ? subset : null)}
                className="font-medium text-ink underline underline-offset-2"
              >
                Apply to all exercises
              </button>
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${moreId}-note`} className="text-sm font-medium">
              Patient note
            </label>
            <Textarea
              id={`${moreId}-note`}
              rows={3}
              value={item.note ?? ""}
              maxLength={LIMITS.itemNote}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="e.g. Keep the movement slow. Stop short of any pinch."
              aria-describedby={`${moreId}-note-hint`}
              className="text-[15px]"
            />
            <p id={`${moreId}-note-hint`} className="text-xs text-muted">
              {patientFirstName
                ? `Shown to ${patientFirstName} as “From ${clinicianFirstName}”.`
                : `Shown to the patient as “From ${clinicianFirstName}”.`}
            </p>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}
