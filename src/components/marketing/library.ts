import { EXERCISES } from "@/content/exercises";
import type { ExerciseSeed } from "@/content/types";

/** Look up a library exercise by slug for brand art. Returns null if it isn't in the library. */
export function libraryExercise(slug: string): ExerciseSeed | null {
  return EXERCISES.find((e) => e.slug === slug) ?? null;
}
