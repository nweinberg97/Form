import type { Demo } from "@/lib/rig";

export const BODY_AREAS = ["neck", "shoulder", "upper-back", "lower-back", "core", "hip", "knee", "ankle", "arm"] as const;
export type BodyArea = (typeof BODY_AREAS)[number];

export const BODY_AREA_LABEL: Record<BodyArea, string> = {
  neck: "Neck",
  shoulder: "Shoulder",
  "upper-back": "Upper back",
  "lower-back": "Lower back",
  core: "Core",
  hip: "Hip",
  knee: "Knee",
  ankle: "Ankle & foot",
  arm: "Elbow & wrist",
};

export const CATEGORIES = ["mobility", "strength", "stretch", "stability", "balance", "control"] as const;
export type Category = (typeof CATEGORIES)[number];

export const EQUIPMENT = ["none", "band", "wall", "chair", "mat", "step", "towel", "doorway", "ball", "foam-roller"] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  none: "No equipment",
  band: "Resistance band",
  wall: "Wall",
  chair: "Chair",
  mat: "Mat",
  step: "Step",
  towel: "Towel",
  doorway: "Doorway",
  ball: "Exercise ball",
  "foam-roller": "Foam roller",
};

export type ExerciseSeed = {
  slug: string;
  name: string;
  /** One sentence: what this is, in plain language. */
  summary: string;
  bodyAreas: BodyArea[];
  movementPatterns: string[];
  categories: Category[];
  equipment: Equipment[];
  /** 1 gentle · 2 moderate · 3 challenging */
  difficulty: 1 | 2 | 3;
  /** Can be prescribed for one side only. */
  lateralitySupported: boolean;
  defaultDosage: {
    sets: number;
    reps?: number;
    durationSec?: number;
    perSide?: boolean;
  };
  /** Rough seconds one set takes (incl. a short rest), for session estimates. */
  secondsPerSet: number;
  /** 3–5 short imperative steps. */
  instructions: string[];
  /** 2–3 short technique cues. */
  formCues: string[];
  /** What it should feel like. One sentence. */
  feel: string;
  commonMistakes: string[];
  /** Generic, non-diagnostic safety note that defers to the clinician. */
  safetyNotes: string;
  tags: string[];
  progressions: string[];
  regressions: string[];
  demo: Demo;
};

/** An exercise imported from the open (public-domain) library: photos instead of a movement guide. */
export type OpenExerciseSeed = Omit<ExerciseSeed, "demo" | "progressions" | "regressions"> & {
  images: string[];
  sourceId: string;
};

export const OPEN_LIBRARY_ATTRIBUTION = "free-exercise-db (public domain)";
