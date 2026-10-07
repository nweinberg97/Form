import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import type { Queryable } from "../db";
import {
  exerciseCompletions,
  exerciseMedia,
  exercises,
  programExercises,
  programs,
  programVersions,
  sessionItems,
  sessions,
  users,
  type Session,
} from "../db/schema";
import { addDays, diffDays, weekday, type ISODate } from "@/lib/dates";
import type { Demo } from "@/lib/rig";

/**
 * Prescription vs occurrence.
 *
 * A Program has versions; each version prescribes exercises on weekdays.
 * An *occurrence* — "what should happen on Oct 7" — is computed from the
 * version in force on that date. A Session row exists only once something
 * happened (started, skipped). "Missed" is derived: a past occurrence with
 * no session.
 */

export type ExerciseSummary = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  bodyAreas: string[];
  equipment: string[];
  secondsPerSet: number;
  instructions: string[];
  formCues: string[];
  feel: string;
  safetyNotes: string;
  commonMistakes: string[];
  isActive: boolean;
  demo: Demo | null;
  video: ExerciseVideo | null;
};

export type ExerciseVideo =
  | { provider: "youtube"; id: string; title: string | null; source: string | null; clinicChoice: boolean }
  | { provider: "file"; url: string; poster: string | null; captionsUrl: string | null; title: string | null; source: string | null; clinicChoice: boolean };

export type PlanItem = {
  programExerciseId: string;
  lineageId: string;
  programId: string;
  programTitle: string;
  versionId: string;
  position: number;
  sets: number;
  reps: number | null;
  durationSec: number | null;
  perSide: boolean;
  side: "both" | "left" | "right" | "alternating";
  note: string | null;
  /** Weekdays for this exercise; null = every program day. */
  days: number[] | null;
  exercise: ExerciseSummary;
};

type VersionRow = {
  id: string;
  programId: string;
  version: number;
  days: number[];
  effectiveFrom: string;
  title: string;
};

type ProgramRow = {
  id: string;
  title: string;
  status: "active" | "archived" | "completed";
  startDate: string;
  endDate: string | null;
  createdAt: Date;
  clinicianId: string;
  clinicianName: string;
  clinicianCredentials: string | null;
};

export type PatientPlan = {
  programs: ProgramRow[];
  versions: VersionRow[];
  /** Every prescribed exercise across every version, keyed by version id. */
  itemsByVersion: Map<string, PlanItem[]>;
};

/**
 * Exercise content as a patient or clinician sees it. Video precedence:
 * the clinic's own video → FORM's curated default → generated movement guide.
 */
export async function loadExerciseSummaries(db: Queryable, ids: string[], orgId: string | null = null) {
  if (ids.length === 0) return new Map<string, ExerciseSummary>();
  const rows = await db.select().from(exercises).where(inArray(exercises.id, ids));
  const media = await db
    .select()
    .from(exerciseMedia)
    .where(
      and(
        inArray(exerciseMedia.exerciseId, ids),
        orgId ? or(isNull(exerciseMedia.orgId), eq(exerciseMedia.orgId, orgId)) : isNull(exerciseMedia.orgId),
      ),
    )
    .orderBy(asc(exerciseMedia.position));
  const map = new Map<string, ExerciseSummary>();
  for (const row of rows) {
    const mine = media.filter((m) => m.exerciseId === row.id);
    const animation = mine.find((m) => m.type === "animation");
    const videos = mine.filter((m) => m.type === "video");
    const videoRow = videos.find((m) => m.orgId) ?? videos.find((m) => !m.orgId);
    let video: ExerciseVideo | null = null;
    if (videoRow?.provider === "youtube" && videoRow.externalId) {
      video = { provider: "youtube", id: videoRow.externalId, title: videoRow.title, source: videoRow.source, clinicChoice: Boolean(videoRow.orgId) };
    } else if (videoRow?.provider === "file" && videoRow.url) {
      video = {
        provider: "file",
        url: videoRow.url,
        poster: videoRow.poster,
        captionsUrl: videoRow.captionsUrl,
        title: videoRow.title,
        source: videoRow.source,
        clinicChoice: Boolean(videoRow.orgId),
      };
    }
    map.set(row.id, {
      id: row.id,
      slug: row.slug,
      name: row.name,
      summary: row.summary,
      bodyAreas: row.bodyAreas,
      equipment: row.equipment,
      secondsPerSet: row.secondsPerSet,
      instructions: row.instructions,
      formCues: row.formCues,
      feel: row.feel,
      safetyNotes: row.safetyNotes,
      commonMistakes: row.commonMistakes,
      isActive: row.isActive,
      demo: animation?.demo ?? null,
      video,
    });
  }
  return map;
}

/** Loads every program (any status) for a patient with all versions and items. */
export async function loadPatientPlan(db: Queryable, patientId: string): Promise<PatientPlan> {
  const programRows = await db
    .select({
      id: programs.id,
      title: programs.title,
      status: programs.status,
      startDate: programs.startDate,
      endDate: programs.endDate,
      createdAt: programs.createdAt,
      clinicianId: programs.clinicianId,
      clinicianName: users.name,
      clinicianCredentials: users.credentials,
    })
    .from(programs)
    .innerJoin(users, eq(users.id, programs.clinicianId))
    .where(eq(programs.patientId, patientId))
    .orderBy(asc(programs.createdAt));

  if (programRows.length === 0) return { programs: [], versions: [], itemsByVersion: new Map() };

  const versions = await db
    .select({
      id: programVersions.id,
      programId: programVersions.programId,
      version: programVersions.version,
      days: programVersions.days,
      effectiveFrom: programVersions.effectiveFrom,
      title: programVersions.title,
    })
    .from(programVersions)
    .where(inArray(programVersions.programId, programRows.map((p) => p.id)))
    .orderBy(asc(programVersions.version));

  const versionIds = versions.map((v) => v.id);
  const peRows = versionIds.length
    ? await db
        .select()
        .from(programExercises)
        .where(inArray(programExercises.versionId, versionIds))
        .orderBy(asc(programExercises.position))
    : [];

  const [owner] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, patientId)).limit(1);
  const exerciseMap = await loadExerciseSummaries(db, [...new Set(peRows.map((r) => r.exerciseId))], owner?.orgId ?? null);
  const programById = new Map(programRows.map((p) => [p.id, p]));
  const versionById = new Map(versions.map((v) => [v.id, v]));

  const itemsByVersion = new Map<string, PlanItem[]>();
  for (const row of peRows) {
    const version = versionById.get(row.versionId)!;
    const program = programById.get(version.programId)!;
    const exercise = exerciseMap.get(row.exerciseId);
    if (!exercise) continue;
    const list = itemsByVersion.get(row.versionId) ?? [];
    list.push({
      programExerciseId: row.id,
      lineageId: row.lineageId,
      programId: program.id,
      programTitle: version.title,
      versionId: row.versionId,
      position: row.position,
      sets: row.sets,
      reps: row.reps,
      durationSec: row.durationSec,
      perSide: row.perSide,
      side: row.side,
      note: row.note,
      days: row.days,
      exercise,
    });
    itemsByVersion.set(row.versionId, list);
  }

  return { programs: programRows, versions, itemsByVersion };
}

/** The version of a program in force on a date (latest version whose effectiveFrom ≤ date). */
export function versionOn(plan: PatientPlan, programId: string, date: ISODate) {
  let found: VersionRow | undefined;
  for (const v of plan.versions) {
    if (v.programId !== programId) continue;
    if (v.effectiveFrom <= date && (!found || v.version > found.version)) found = v;
  }
  return found;
}

function programRunsOn(program: ProgramRow, date: ISODate) {
  if (program.status === "archived" && !program.endDate) return false;
  return program.startDate <= date && (!program.endDate || date <= program.endDate);
}

/** Everything prescribed for a date, aggregated across programs, in a stable order. */
export function itemsForDate(plan: PatientPlan, date: ISODate): PlanItem[] {
  const day = weekday(date);
  const out: PlanItem[] = [];
  for (const program of plan.programs) {
    if (!programRunsOn(program, date)) continue;
    const version = versionOn(plan, program.id, date);
    if (!version) continue;
    for (const item of plan.itemsByVersion.get(version.id) ?? []) {
      const days = item.days && item.days.length ? item.days : version.days;
      if (days.includes(day) && item.exercise.isActive) out.push(item);
    }
  }
  return out;
}

/** The current (latest) version of each active program. */
export function currentVersions(plan: PatientPlan, today: ISODate) {
  return plan.programs
    .filter((p) => p.status === "active" && (!p.endDate || p.endDate >= today))
    .map((program) => {
      const versions = plan.versions.filter((v) => v.programId === program.id);
      const latest = versions.reduce<VersionRow | undefined>((a, v) => (!a || v.version > a.version ? v : a), undefined);
      return { program, version: latest, items: latest ? plan.itemsByVersion.get(latest.id) ?? [] : [] };
    })
    .filter((entry) => entry.version);
}

export function nextScheduledDate(plan: PatientPlan, after: ISODate, horizon = 21) {
  for (let i = 1; i <= horizon; i++) {
    const date = addDays(after, i);
    const items = itemsForDate(plan, date);
    if (items.length) return { date, items };
  }
  return null;
}

export type DayStatus =
  | "completed"
  | "partial"
  | "in_progress"
  | "skipped"
  | "missed"
  | "scheduled"
  | "today"
  | "rest"
  | "before_start";

export type SessionRecord = Pick<
  Session,
  "id" | "scheduledDate" | "status" | "startedAt" | "completedAt" | "durationSec" | "skipReason"
>;

export async function loadSessions(db: Queryable, patientId: string, from: ISODate, to: ISODate) {
  return db
    .select({
      id: sessions.id,
      scheduledDate: sessions.scheduledDate,
      status: sessions.status,
      startedAt: sessions.startedAt,
      completedAt: sessions.completedAt,
      durationSec: sessions.durationSec,
      skipReason: sessions.skipReason,
    })
    .from(sessions)
    .where(and(eq(sessions.patientId, patientId), gte(sessions.scheduledDate, from), lte(sessions.scheduledDate, to)))
    .orderBy(desc(sessions.scheduledDate));
}

export function statusForDay(
  plan: PatientPlan,
  date: ISODate,
  today: ISODate,
  session: SessionRecord | undefined,
): DayStatus {
  if (session) {
    if (session.status === "completed") return "completed";
    if (session.status === "partially_completed") return "partial";
    if (session.status === "skipped") return "skipped";
    if (session.status === "in_progress") return date < today ? "partial" : "in_progress";
  }
  const scheduled = itemsForDate(plan, date).length > 0;
  if (!scheduled) {
    const earliest = plan.programs.reduce<string | null>((min, p) => (!min || p.startDate < min ? p.startDate : min), null);
    return earliest && date < earliest ? "before_start" : "rest";
  }
  if (date < today) return "missed";
  if (date === today) return "today";
  return "scheduled";
}

/** Session items + completions for a started session (the frozen plan). */
export async function loadSessionDetail(db: Queryable, sessionId: string, plan: PatientPlan) {
  const items = await db
    .select({ programExerciseId: sessionItems.programExerciseId, position: sessionItems.position })
    .from(sessionItems)
    .where(eq(sessionItems.sessionId, sessionId))
    .orderBy(asc(sessionItems.position));
  const done = await db
    .select({
      id: exerciseCompletions.id,
      programExerciseId: exerciseCompletions.programExerciseId,
      completedAt: exerciseCompletions.completedAt,
    })
    .from(exerciseCompletions)
    .where(eq(exerciseCompletions.sessionId, sessionId));
  const allItems = new Map<string, PlanItem>();
  for (const list of plan.itemsByVersion.values()) for (const item of list) allItems.set(item.programExerciseId, item);
  const doneMap = new Map(done.map((d) => [d.programExerciseId, d]));
  return items
    .map((row) => {
      const item = allItems.get(row.programExerciseId);
      if (!item) return null;
      const completion = doneMap.get(row.programExerciseId);
      return { ...item, completionId: completion?.id ?? null, completedAt: completion?.completedAt ?? null };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/** Missed scheduled days in a window (excludes today). */
export function missedDays(plan: PatientPlan, sessionsByDate: Map<string, SessionRecord>, from: ISODate, today: ISODate) {
  const out: ISODate[] = [];
  for (let d = from; diffDays(today, d) > 0; d = addDays(d, 1)) {
    if (statusForDay(plan, d, today, sessionsByDate.get(d)) === "missed") out.push(d);
  }
  return out;
}
