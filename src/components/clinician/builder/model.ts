import { BODY_AREA_LABEL, CATEGORIES, EQUIPMENT_LABEL, type BodyArea, type Equipment } from "@/content/types";
import { estimateMinutes } from "@/lib/dosage";
import type { LibraryExercise, TemplateSummary } from "@/server/services/clinician";

/** Mirrors `DraftItem` in src/server/services/programs.ts (kept client-safe). */
export type DraftItemInput = {
  lineageId?: string | null;
  exerciseId: string;
  sets: number;
  reps: number | null;
  durationSec: number | null;
  perSide: boolean;
  side: "both" | "left" | "right" | "alternating";
  days: number[] | null;
  note: string | null;
};

export type DraftInput = { title: string; days: number[]; note: string | null; items: DraftItemInput[] };

export type BuilderItem = DraftItemInput & { key: string };

export type BuilderState = {
  title: string;
  /** True once the clinician typed a title; stops automatic naming. */
  titleTouched: boolean;
  days: number[];
  note: string;
  items: BuilderItem[];
};

export const LIMITS = { sets: [1, 20], reps: [1, 200], duration: [5, 3600], items: 30, title: 80, note: 1000, itemNote: 600 } as const;

let counter = 0;
export const newKey = () => `i${Date.now().toString(36)}${(counter++).toString(36)}`;

export function itemFromExercise(exercise: LibraryExercise): BuilderItem {
  const timed = Boolean(exercise.defaultDurationSec);
  return {
    key: newKey(),
    lineageId: null,
    exerciseId: exercise.id,
    sets: exercise.defaultSets || 2,
    reps: timed ? null : exercise.defaultReps ?? 10,
    durationSec: timed ? exercise.defaultDurationSec : null,
    perSide: exercise.defaultPerSide,
    side: "both",
    days: null,
    note: null,
  };
}

export function itemsFromTemplate(template: TemplateSummary, known: Set<string>): BuilderItem[] {
  return template.items
    .filter((i) => known.has(i.exerciseId))
    .map((i) => ({
      key: newKey(),
      lineageId: null,
      exerciseId: i.exerciseId,
      sets: i.sets,
      reps: i.durationSec ? null : i.reps ?? 10,
      durationSec: i.durationSec,
      perSide: i.perSide,
      side: i.side,
      days: i.days && i.days.length ? i.days : null,
      note: i.note,
    }));
}

export function toDraft(state: BuilderState): DraftInput {
  return {
    title: state.title.trim(),
    days: [...state.days].sort((a, b) => a - b),
    note: state.note.trim() ? state.note.trim() : null,
    items: state.items.map(({ key: _key, ...item }) => ({
      ...item,
      reps: item.durationSec ? null : item.reps,
      days: subsetDays(item.days, state.days),
      note: item.note?.trim() ? item.note.trim() : null,
    })),
  };
}

/** An exercise's own days, limited to the program's days; null = every program day. */
export function subsetDays(itemDays: number[] | null, programDays: number[]) {
  if (!itemDays?.length) return null;
  const valid = [...new Set(itemDays.filter((d) => programDays.includes(d)))].sort((a, b) => a - b);
  return valid.length && valid.length < programDays.length ? valid : null;
}

/** Comparable snapshot for unsaved-change detection. */
export const snapshot = (state: BuilderState) => JSON.stringify(toDraft(state));

export type Errors = { title?: string; days?: string; items?: string; byItem: Record<string, string> };

/** Same rules as `draftSchema` on the server, with the same wording. */
export function validate(state: BuilderState, mode: "program" | "template"): Errors {
  const errors: Errors = { byItem: {} };
  const title = state.title.trim();
  if (!title) errors.title = mode === "template" ? "Name the template." : "Give the program a name.";
  else if (title.length > LIMITS.title) errors.title = `Keep the name under ${LIMITS.title} characters.`;
  if (state.days.length === 0) errors.days = "Choose at least one day.";
  if (state.items.length === 0) errors.items = "Add at least one exercise.";
  else if (state.items.length > LIMITS.items) errors.items = `A program can hold up to ${LIMITS.items} exercises.`;
  if (state.note.trim().length > LIMITS.note) errors.items = `Keep the program note under ${LIMITS.note} characters.`;
  for (const item of state.items) {
    if (item.reps === null && item.durationSec === null) errors.byItem[item.key] = "Each exercise needs reps or a duration.";
    else if (item.sets < LIMITS.sets[0] || item.sets > LIMITS.sets[1]) errors.byItem[item.key] = "Sets must be between 1 and 20.";
    else if (item.durationSec !== null && (item.durationSec < LIMITS.duration[0] || item.durationSec > LIMITS.duration[1]))
      errors.byItem[item.key] = "Holds must be between 5 seconds and 60 minutes.";
    else if (item.durationSec === null && item.reps !== null && (item.reps < LIMITS.reps[0] || item.reps > LIMITS.reps[1]))
      errors.byItem[item.key] = "Reps must be between 1 and 200.";
    else if ((item.note ?? "").trim().length > LIMITS.itemNote) errors.byItem[item.key] = `Keep the note under ${LIMITS.itemNote} characters.`;
  }
  return errors;
}

export const hasErrors = (e: Errors) => Boolean(e.title || e.days || e.items || Object.keys(e.byItem).length);

export function minutesFor(items: BuilderItem[], byId: Map<string, LibraryExercise>) {
  if (!items.length) return 0;
  return estimateMinutes(items.map((i) => ({ ...i, secondsPerSet: byId.get(i.exerciseId)?.secondsPerSet ?? 45 })));
}

/** "<Body area> program", from the body area most represented in the plan. */
export function suggestTitle(items: BuilderItem[], byId: Map<string, LibraryExercise>) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const area = byId.get(item.exerciseId)?.bodyAreas[0];
    if (area) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return "";
  const first = areaLabel(ranked[0][0]);
  if (ranked[1] && ranked[1][1] === ranked[0][1]) return `${first} & ${areaLabel(ranked[1][0]).toLowerCase()} program`;
  return `${first} program`;
}

export const areaLabel = (area: string) => BODY_AREA_LABEL[area as BodyArea] ?? area;
export const equipmentLabel = (eq: string) => EQUIPMENT_LABEL[eq as Equipment] ?? eq;
export const DIFFICULTY_WORD: Record<number, string> = { 1: "Gentle", 2: "Moderate", 3: "Challenging" };
export const categoryLabel = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
export { CATEGORIES };

/* ---------------- Search ---------------- */

export type SearchIndex = { exercise: LibraryExercise; name: string; hay: string };

export function buildIndex(library: LibraryExercise[]): SearchIndex[] {
  return library.map((exercise) => ({
    exercise,
    name: exercise.name.toLowerCase(),
    hay: [
      exercise.name,
      exercise.summary,
      ...exercise.bodyAreas,
      ...exercise.bodyAreas.map(areaLabel),
      ...exercise.equipment,
      ...exercise.equipment.map(equipmentLabel),
      ...exercise.movementPatterns,
      ...exercise.categories,
      ...exercise.tags,
    ]
      .join(" ")
      .toLowerCase()
      .replace(/[-_]/g, " "),
  }));
}

export function searchLibrary(
  index: SearchIndex[],
  query: string,
  filters: { area?: string | null; equipment?: string | null; category?: string | null; source?: string | null } = {},
) {
  const words = query
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out: { exercise: LibraryExercise; score: number }[] = [];
  for (const entry of index) {
    const e = entry.exercise;
    if (filters.area && !e.bodyAreas.includes(filters.area)) continue;
    if (filters.equipment && !e.equipment.includes(filters.equipment)) continue;
    if (filters.category && !e.categories.includes(filters.category)) continue;
    if (filters.source && e.source !== filters.source) continue;
    // FORM's rehab library ranks above the open library on ties.
    const sourceBoost = e.source === "form" ? 0.5 : 0;
    if (!words.length) {
      out.push({ exercise: e, score: sourceBoost });
      continue;
    }
    let score = 0;
    let ok = true;
    for (const word of words) {
      if (entry.name.startsWith(word)) score += 6;
      else if (entry.name.split(" ").some((w) => w.startsWith(word))) score += 4;
      else if (entry.name.includes(word)) score += 3;
      else if (entry.hay.includes(word)) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ exercise: e, score: score + sourceBoost });
  }
  return out.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name)).map((r) => r.exercise);
}
