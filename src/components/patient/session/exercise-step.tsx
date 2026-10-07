"use client";

import { useState } from "react";
import { ExerciseDemo } from "@/components/exercise/exercise-demo";
import { ExerciseDetails } from "@/components/patient/exercise-details";
import { formatDosage, formatSetAmount, SIDE_LABEL } from "@/lib/dosage";
import { HoldTimer, SetTracker } from "./set-tracker";
import type { FlowItem } from "./types";

export function dosageLine(item: FlowItem, setsDone: number) {
  const amount = formatSetAmount(item);
  if (item.sets <= 1) return amount.charAt(0).toUpperCase() + amount.slice(1);
  if (setsDone >= item.sets) return `All ${item.sets} sets done · ${amount}`;
  return `Set ${Math.min(setsDone + 1, item.sets)} of ${item.sets} · ${amount}`;
}

/**
 * One exercise, in the order the patient needs it (PRD §40):
 * what is this → how much → see it → how to do it → feel → physio's note.
 */
export function ExerciseStep({
  item,
  index,
  total,
  clinicianFirstName,
  multiplePrograms,
  setsDone,
  onSetsChange,
}: {
  item: FlowItem;
  index: number;
  total: number;
  clinicianFirstName: string | null;
  multiplePrograms: boolean;
  setsDone: number;
  onSetsChange: (n: number) => void;
}) {
  const [timerKey, setTimerKey] = useState(0);
  const ex = item.exercise;

  return (
    <article aria-labelledby="exercise-name" className="flex flex-col gap-6">
      <header>
        <p className="kicker text-muted">
          <span className="tabular">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span aria-hidden> · </span>
          <span className="tabular">{formatDosage(item)}</span>
        </p>
        <h1
          id="exercise-name"
          tabIndex={-1}
          className="mt-2 text-[2.5rem] leading-[0.95] font-black tracking-[-0.045em] outline-none sm:text-5xl"
        >
          {ex.name}
        </h1>
        {multiplePrograms ? <p className="mt-1.5 text-[15px] text-muted">{item.programTitle}</p> : null}
        <p className="mt-3 text-xl font-semibold tracking-[-0.015em] tabular" aria-live="polite">
          {dosageLine(item, setsDone)}
        </p>
        {item.side !== "both" ? (
          <p className="mt-1 text-[15px] font-medium text-muted">{SIDE_LABEL[item.side]}</p>
        ) : null}
      </header>

      <ExerciseDemo name={ex.name} demo={ex.demo} video={ex.video} images={ex.images} attribution={ex.attribution} instructions={ex.instructions} size="lg" />

      {item.durationSec ? (
        <HoldTimer
          key={timerKey}
          seconds={item.durationSec}
          perSide={item.perSide}
          onFinished={() => {
            if (setsDone < item.sets) onSetsChange(setsDone + 1);
            if (setsDone + 1 < item.sets) window.setTimeout(() => setTimerKey((k) => k + 1), 2200);
          }}
        />
      ) : null}

      <SetTracker sets={item.sets} done={setsDone} onChange={onSetsChange} />

      <ExerciseDetails exercise={ex} note={item.note} clinicianFirstName={clinicianFirstName} />
    </article>
  );
}
