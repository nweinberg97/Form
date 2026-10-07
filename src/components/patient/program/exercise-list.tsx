"use client";

import { useState } from "react";
import { ChevronRight, MessageSquareText } from "lucide-react";
import type { PlanItem } from "@/server/services/plan";
import { formatDays } from "@/lib/dates";
import { formatDosage, SIDE_LABEL } from "@/lib/dosage";
import { DemoThumb, ExerciseDemo } from "@/components/exercise/exercise-demo";
import { Sheet } from "@/components/ui/sheet";
import { ExerciseDetails } from "@/components/patient/exercise-details";

/** Every exercise in a program. Tap for the demonstration, instructions and the physio's note. */
export function ProgramExerciseList({
  items,
  programDays,
  clinicianFirstName,
}: {
  items: PlanItem[];
  programDays: number[];
  clinicianFirstName: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((i) => i.programExerciseId === openId) ?? null;

  return (
    <>
      <ol className="divide-y divide-line border-y border-line">
        {items.map((item, i) => {
          const subset =
            item.days && item.days.length && item.days.length !== programDays.length ? formatDays(item.days) : null;
          return (
            <li key={item.programExerciseId}>
              <button
                type="button"
                onClick={() => setOpenId(item.programExerciseId)}
                className="flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-sunken/50"
                aria-haspopup="dialog"
              >
                <span aria-hidden className="w-6 shrink-0 font-mono text-[13px] text-muted tabular">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span aria-hidden className="w-16 shrink-0">
                  <DemoThumb demo={item.exercise.demo} images={item.exercise.images} label={`${item.exercise.name} demonstration`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold tracking-[-0.015em]">{item.exercise.name}</span>
                  <span className="block text-[15px] text-muted tabular">
                    {formatDosage(item)}
                    {item.side !== "both" ? ` · ${SIDE_LABEL[item.side]}` : ""}
                    {subset ? ` · ${subset}` : ""}
                  </span>
                  {item.note ? (
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      <MessageSquareText aria-hidden className="size-3.5" />
                      Note from {clinicianFirstName ?? "your physio"}
                    </span>
                  ) : null}
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </button>
            </li>
          );
        })}
      </ol>

      <Sheet
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open?.exercise.name ?? "Exercise"}
        description={open ? `${formatDosage(open)}${open.side !== "both" ? ` · ${SIDE_LABEL[open.side]}` : ""}` : undefined}
        size="lg"
      >
        {open ? (
          <div className="flex flex-col gap-7">
            <ExerciseDemo
              key={open.programExerciseId}
              name={open.exercise.name}
              demo={open.exercise.demo}
              video={open.exercise.video}
              images={open.exercise.images}
              attribution={open.exercise.attribution}
              instructions={open.exercise.instructions}
            />
            <ExerciseDetails
              exercise={open.exercise}
              note={open.note}
              clinicianFirstName={clinicianFirstName}
              headingLevel="h3"
            />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
