import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Queryable } from "../db";
import { attentionItems, feedback, users } from "../db/schema";
import { addDays, isoWeekKey, todayIn } from "@/lib/dates";
import { loadPatientPlan, loadSessions, missedDays } from "./plan";

type Kind = (typeof attentionItems.$inferInsert)["kind"];

/**
 * Attention items state what happened — "Wall Angels marked painful" —
 * never what it means. Clinical judgement stays with the clinician.
 */
export async function raiseAttention(
  db: Queryable,
  item: { orgId: string; patientId: string; kind: Kind; message: string; exerciseId?: string | null; dedupeKey?: string },
) {
  await db
    .insert(attentionItems)
    .values({ ...item, exerciseId: item.exerciseId ?? null, dedupeKey: item.dedupeKey ?? null })
    .onConflictDoNothing();
}

/** Repeated "Hard" or "Painful" on the same exercise within 7 days. */
export async function checkRepeat(
  db: Queryable,
  args: {
    rating: "hard" | "painful";
    orgId: string;
    patientId: string;
    lineageId: string;
    exerciseId: string;
    exerciseName: string;
    timezone: string;
  },
) {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const rows = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(
      and(
        eq(feedback.patientId, args.patientId),
        eq(feedback.lineageId, args.lineageId),
        eq(feedback.rating, args.rating),
        gte(feedback.createdAt, since),
      ),
    );
  if (rows.length >= 2) {
    const times = rows.length === 2 ? "twice" : `${rows.length} times`;
    await raiseAttention(db, {
      orgId: args.orgId,
      patientId: args.patientId,
      kind: args.rating === "hard" ? "hard_repeat" : "pain",
      exerciseId: args.exerciseId,
      message: `${args.exerciseName} marked ${args.rating === "hard" ? "Hard" : "painful"} ${times} this week`,
      dedupeKey: `${args.rating}-repeat:${args.lineageId}:${isoWeekKey(todayIn(args.timezone))}:${rows.length >= 3 ? "3" : "2"}`,
    });
  }
}

/** Derived signals that depend on the calendar (missed sessions). Idempotent. */
export async function refreshDerivedAttention(db: Queryable, patientIds: string[]) {
  if (patientIds.length === 0) return;
  const patients = await db
    .select({ id: users.id, orgId: users.orgId, timezone: users.timezone, dischargedAt: users.dischargedAt })
    .from(users)
    .where(inArray(users.id, patientIds));
  for (const patient of patients) {
    if (patient.dischargedAt) continue;
    const today = todayIn(patient.timezone);
    const from = addDays(today, -7);
    const plan = await loadPatientPlan(db, patient.id);
    if (plan.programs.length === 0) continue;
    const records = await loadSessions(db, patient.id, from, today);
    const missed = missedDays(plan, new Map(records.map((r) => [r.scheduledDate, r])), from, today);
    if (missed.length >= 2) {
      await raiseAttention(db, {
        orgId: patient.orgId,
        patientId: patient.id,
        kind: "missed_repeat",
        message: `Missed ${missed.length} scheduled sessions in the last 7 days`,
        dedupeKey: `missed:${isoWeekKey(today)}`,
      });
    }
  }
}

export async function resolveAttention(
  db: Queryable,
  where: { patientId: string; ids?: string[]; exerciseIds?: string[]; kinds?: Kind[] },
  resolvedById: string,
) {
  const conditions = [eq(attentionItems.patientId, where.patientId), isNull(attentionItems.resolvedAt)];
  if (where.ids) conditions.push(inArray(attentionItems.id, where.ids));
  const filters = [];
  if (where.exerciseIds?.length) filters.push(inArray(attentionItems.exerciseId, where.exerciseIds));
  if (where.kinds?.length) filters.push(inArray(attentionItems.kind, where.kinds));
  if (filters.length) conditions.push(filters.length === 1 ? filters[0] : sql`(${sql.join(filters, sql` or `)})`);
  await db
    .update(attentionItems)
    .set({ resolvedAt: new Date(), resolvedById })
    .where(and(...conditions));
}
