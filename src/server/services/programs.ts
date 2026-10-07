import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Queryable } from "../db";
import { exercises, programExercises, programs, programVersions, templateExercises, templates } from "../db/schema";
import { formatDays } from "@/lib/dates";
import { formatDosage, SIDE_LABEL } from "@/lib/dosage";

/* ------------------------------------------------------------------ */
/* Draft shape shared by the builder, templates and assignment         */
/* ------------------------------------------------------------------ */

const day = z.number().int().min(0).max(6);

export const draftItemSchema = z
  .object({
    /** Present when editing an existing prescription; keeps history continuous. */
    lineageId: z.string().uuid().optional().nullable(),
    exerciseId: z.string().uuid(),
    sets: z.number().int().min(1, "Sets must be at least 1").max(20),
    reps: z.number().int().min(1).max(200).nullable(),
    durationSec: z.number().int().min(5).max(3600).nullable(),
    perSide: z.boolean(),
    side: z.enum(["both", "left", "right", "alternating"]),
    days: z.array(day).max(7).nullable(),
    note: z.string().trim().max(600).nullable(),
  })
  .refine((item) => item.reps !== null || item.durationSec !== null, { message: "Each exercise needs reps or a duration." });

export const draftSchema = z.object({
  title: z.string().trim().min(1, "Give the program a name.").max(80),
  days: z.array(day).min(1, "Choose at least one day.").max(7),
  note: z.string().trim().max(1000).nullable(),
  items: z.array(draftItemSchema).min(1, "Add at least one exercise.").max(30),
});

export type Draft = z.infer<typeof draftSchema>;
export type DraftItem = z.infer<typeof draftItemSchema>;

/* ------------------------------------------------------------------ */
/* Diff: human-readable change summary between two versions            */
/* ------------------------------------------------------------------ */

type Comparable = DraftItem & { lineageId: string; name: string };

const sameDays = (a: number[] | null, b: number[] | null) =>
  JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());

export function diffVersions(
  before: { title: string; days: number[]; note: string | null; items: Comparable[] } | null,
  after: { title: string; days: number[]; note: string | null; items: Comparable[] },
): string[] {
  if (!before) return ["Program created"];
  const changes: string[] = [];
  if (before.title !== after.title) changes.push(`Renamed to “${after.title}”`);
  if (!sameDays(before.days, after.days)) changes.push(`Schedule ${formatDays(before.days)} → ${formatDays(after.days)}`);
  if ((before.note ?? "") !== (after.note ?? "")) changes.push(after.note ? "Updated program note" : "Removed program note");

  const beforeBy = new Map(before.items.map((i) => [i.lineageId, i]));
  const afterBy = new Map(after.items.map((i) => [i.lineageId, i]));

  for (const item of before.items) if (!afterBy.has(item.lineageId)) changes.push(`Removed ${item.name}`);
  for (const item of after.items) {
    const prev = beforeBy.get(item.lineageId);
    if (!prev) {
      changes.push(`Added ${item.name} · ${formatDosage(item)}`);
      continue;
    }
    const prevDose = formatDosage(prev);
    const nextDose = formatDosage(item);
    if (prevDose !== nextDose) changes.push(`${item.name} ${prevDose} → ${nextDose}`);
    if (prev.side !== item.side) changes.push(`${item.name}: ${SIDE_LABEL[item.side].toLowerCase()}`);
    if (!sameDays(prev.days, item.days))
      changes.push(`${item.name}: ${item.days?.length ? formatDays(item.days) : "every program day"}`);
    if ((prev.note ?? "") !== (item.note ?? ""))
      changes.push(item.note ? (prev.note ? `Updated note on ${item.name}` : `Added note to ${item.name}`) : `Removed note from ${item.name}`);
  }

  const order = (items: Comparable[]) => items.filter((i) => beforeBy.has(i.lineageId) && afterBy.has(i.lineageId)).map((i) => i.lineageId).join();
  if (order(before.items) !== order(after.items)) changes.push("Reordered exercises");
  return changes;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

export async function exerciseNames(db: Queryable, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(inArray(exercises.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function loadVersionDraft(db: Queryable, versionId: string) {
  const [version] = await db.select().from(programVersions).where(eq(programVersions.id, versionId)).limit(1);
  if (!version) return null;
  const items = await db
    .select()
    .from(programExercises)
    .where(eq(programExercises.versionId, versionId))
    .orderBy(asc(programExercises.position));
  return { version, items };
}

/**
 * Writes a new version of a program (or creates the program). Returns null
 * when nothing changed, so saving an untouched program is a no-op.
 */
export async function writeProgramVersion(
  tx: Queryable,
  args: {
    orgId: string;
    patientId: string;
    clinicianId: string;
    programId: string | null;
    draft: Draft;
    effectiveFrom: string;
    startDate: string;
  },
) {
  const { draft } = args;
  const names = await exerciseNames(tx, draft.items.map((i) => i.exerciseId));
  for (const item of draft.items) if (!names.has(item.exerciseId)) throw new Error("Unknown exercise");

  let programId = args.programId;
  let previous: Awaited<ReturnType<typeof loadVersionDraft>> = null;
  let nextVersion = 1;

  if (programId) {
    const [program] = await tx
      .select()
      .from(programs)
      .where(and(eq(programs.id, programId), eq(programs.patientId, args.patientId), eq(programs.orgId, args.orgId)))
      .limit(1);
    if (!program) throw new Error("Program not found");
    const [latest] = await tx
      .select({ id: programVersions.id, version: programVersions.version })
      .from(programVersions)
      .where(eq(programVersions.programId, programId))
      .orderBy(desc(programVersions.version))
      .limit(1);
    if (latest) {
      previous = await loadVersionDraft(tx, latest.id);
      nextVersion = latest.version + 1;
    }
  }

  // Keep lineage only for ids that actually existed in the previous version.
  const previousLineages = new Set(previous?.items.map((i) => i.lineageId) ?? []);
  const items = draft.items.map((item) => ({
    ...item,
    lineageId: item.lineageId && previousLineages.has(item.lineageId) ? item.lineageId : randomUUID(),
    name: names.get(item.exerciseId)!,
    perSide: item.perSide,
  }));

  const previousNames = previous ? await exerciseNames(tx, previous.items.map((i) => i.exerciseId)) : new Map();
  const changeSummary = diffVersions(
    previous
      ? {
          title: previous.version.title,
          days: previous.version.days,
          note: previous.version.note,
          items: previous.items.map((i) => ({ ...i, name: previousNames.get(i.exerciseId) ?? "Exercise" })),
        }
      : null,
    { title: draft.title, days: draft.days, note: draft.note, items },
  );

  if (previous && changeSummary.length === 0) return { programId: programId!, versionId: previous.version.id, changed: false, changeSummary };

  if (!programId) {
    const [program] = await tx
      .insert(programs)
      .values({
        orgId: args.orgId,
        patientId: args.patientId,
        clinicianId: args.clinicianId,
        title: draft.title,
        startDate: args.startDate,
      })
      .returning({ id: programs.id });
    programId = program.id;
  }

  const [version] = await tx
    .insert(programVersions)
    .values({
      programId,
      version: nextVersion,
      days: draft.days,
      effectiveFrom: args.effectiveFrom,
      title: draft.title,
      note: draft.note,
      changeSummary,
      createdById: args.clinicianId,
    })
    .returning({ id: programVersions.id });

  await tx.insert(programExercises).values(
    items.map((item, position) => ({
      versionId: version.id,
      lineageId: item.lineageId,
      exerciseId: item.exerciseId,
      position,
      sets: item.sets,
      reps: item.durationSec ? null : item.reps,
      durationSec: item.durationSec,
      perSide: item.perSide,
      side: item.side,
      days: item.days && item.days.length && item.days.length < draft.days.length ? item.days : null,
      note: item.note || null,
    })),
  );

  await tx
    .update(programs)
    .set({ currentVersionId: version.id, title: draft.title, updatedAt: new Date(), status: "active" })
    .where(eq(programs.id, programId));

  const removedExerciseIds = previous
    ? previous.items.filter((p) => !items.some((i) => i.lineageId === p.lineageId)).map((p) => p.exerciseId)
    : [];
  const changedExerciseIds = items
    .filter((i) => {
      const prev = previous?.items.find((p) => p.lineageId === i.lineageId);
      return prev && (prev.sets !== i.sets || prev.reps !== i.reps || prev.durationSec !== i.durationSec || (prev.note ?? "") !== (i.note ?? ""));
    })
    .map((i) => i.exerciseId);

  return {
    programId,
    versionId: version.id,
    version: nextVersion,
    changed: true,
    changeSummary,
    touchedExerciseIds: [...removedExerciseIds, ...changedExerciseIds],
    addedCount: items.filter((i) => !previousLineages.has(i.lineageId)).length,
  };
}

export async function loadTemplateDraft(db: Queryable, templateId: string, orgId: string) {
  const [template] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.orgId, orgId)))
    .limit(1);
  if (!template) return null;
  const items = await db
    .select()
    .from(templateExercises)
    .where(eq(templateExercises.templateId, templateId))
    .orderBy(asc(templateExercises.position));
  return { template, items };
}
