import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Queryable } from "../db";
import { exerciseMedia, exerciseRelations, exercises } from "../db/schema";
import { EXERCISES } from "@/content/exercises";
import { EXERCISE_VIDEOS } from "@/content/videos";
import OPEN_LIBRARY from "@/content/open-library.json";
import { OPEN_LIBRARY_ATTRIBUTION, type ExerciseSeed, type OpenExerciseSeed } from "@/content/types";

type AnySeed = (ExerciseSeed & { source: "form" }) | (OpenExerciseSeed & { source: "open" });
const ALL: AnySeed[] = [
  ...EXERCISES.map((e) => ({ ...e, source: "form" as const })),
  ...(OPEN_LIBRARY as OpenExerciseSeed[]).map((e) => ({ ...e, source: "open" as const })),
];

/**
 * Upserts FORM's approved exercise library (org_id = null) from source.
 * Safe to run on every boot: content edits in src/content/exercises.ts
 * flow into the database without touching prescriptions that reference them.
 */
export async function syncExerciseLibrary(db: Queryable) {
  const existing = await db
    .select({ id: exercises.id, slug: exercises.slug })
    .from(exercises)
    .where(inArray(exercises.slug, ALL.map((e) => e.slug)));
  const idBySlug = new Map(existing.map((row) => [row.slug, row.id]));

  for (const seed of ALL) {
    const values = {
      orgId: null,
      slug: seed.slug,
      name: seed.name,
      summary: seed.summary,
      bodyAreas: seed.bodyAreas,
      movementPatterns: seed.movementPatterns,
      categories: seed.categories,
      equipment: seed.equipment,
      difficulty: seed.difficulty,
      lateralitySupported: seed.lateralitySupported,
      defaultSets: seed.defaultDosage.sets,
      defaultReps: seed.defaultDosage.reps ?? null,
      defaultDurationSec: seed.defaultDosage.durationSec ?? null,
      defaultPerSide: seed.defaultDosage.perSide ?? false,
      secondsPerSet: seed.secondsPerSet,
      instructions: seed.instructions,
      formCues: seed.formCues,
      feel: seed.feel,
      commonMistakes: seed.commonMistakes,
      safetyNotes: seed.safetyNotes,
      tags: seed.tags,
      source: seed.source,
      attribution: seed.source === "open" ? OPEN_LIBRARY_ATTRIBUTION : null,
      isActive: true,
    };
    const currentId = idBySlug.get(seed.slug);
    if (currentId) {
      await db.update(exercises).set(values).where(eq(exercises.id, currentId));
    } else {
      const [row] = await db.insert(exercises).values(values).returning({ id: exercises.id });
      idBySlug.set(seed.slug, row.id);
    }
  }

  const ids = [...idBySlug.values()];
  // Replace FORM's default media only — a clinic's own videos (org_id set) are untouched.
  await db.delete(exerciseMedia).where(and(inArray(exerciseMedia.exerciseId, ids), isNull(exerciseMedia.orgId)));
  await db.insert(exerciseMedia).values([
    ...EXERCISES.map((seed) => ({
      exerciseId: idBySlug.get(seed.slug)!,
      type: "animation" as const,
      provider: "generated" as const,
      altText: `Animated movement guide for ${seed.name}`,
      demo: seed.demo,
      position: 1,
    })),
    ...(OPEN_LIBRARY as OpenExerciseSeed[]).flatMap((seed) =>
      seed.images.map((url, i) => ({
        exerciseId: idBySlug.get(seed.slug)!,
        type: "image" as const,
        provider: "file" as const,
        url,
        source: OPEN_LIBRARY_ATTRIBUTION,
        altText: `${seed.name} — ${i === 0 ? "start" : "end"} position`,
        position: 10 + i,
      })),
    ),
    ...EXERCISE_VIDEOS.filter((v) => idBySlug.has(v.slug)).map((v) => ({
      exerciseId: idBySlug.get(v.slug)!,
      type: "video" as const,
      provider: "youtube" as const,
      externalId: v.youtubeId,
      title: v.title,
      source: v.source,
      altText: `Video demonstration of ${EXERCISES.find((e) => e.slug === v.slug)?.name ?? "the exercise"}`,
      position: 0,
    })),
  ]);

  await db.delete(exerciseRelations).where(inArray(exerciseRelations.exerciseId, ids));
  const relationRows = EXERCISES.flatMap((seed) => [
    ...seed.progressions.map((slug) => ({ slug: seed.slug, related: slug, kind: "progression" as const })),
    ...seed.regressions.map((slug) => ({ slug: seed.slug, related: slug, kind: "regression" as const })),
  ])
    .filter((r) => idBySlug.has(r.related))
    .map((r) => ({ exerciseId: idBySlug.get(r.slug)!, relatedId: idBySlug.get(r.related)!, kind: r.kind }));
  if (relationRows.length) await db.insert(exerciseRelations).values(relationRows).onConflictDoNothing();
}
