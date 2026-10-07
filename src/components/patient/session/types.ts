import type { ExerciseSummary, PlanItem } from "@/server/services/plan";

/** The slice of a session item the focused flow needs. */
export type FlowItem = {
  programExerciseId: string;
  programTitle: string;
  sets: number;
  reps: number | null;
  durationSec: number | null;
  perSide: boolean;
  side: PlanItem["side"];
  note: string | null;
  exercise: ExerciseSummary;
  done: boolean;
  completionId: string | null;
};
