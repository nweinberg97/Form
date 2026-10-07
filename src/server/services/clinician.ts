import { and, asc, count, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import {
  attentionItems,
  careRelationships,
  clinicianNotes,
  exercises,
  feedback,
  invitations,
  messages,
  programVersions,
  programs,
  templateExercises,
  templates,
  users,
} from "../db/schema";
import type { Clinician } from "../auth/guards";
import {
  addDays,
  formatDay,
  relativeDay,
  startOfWeek,
  timeAgo,
  todayIn,
  weekDates,
  WEEKDAYS_SHORT,
  type ISODate,
} from "@/lib/dates";
import { estimateMinutes } from "@/lib/dosage";
import {
  currentVersions,
  itemsForDate,
  loadExerciseSummaries,
  loadPatientPlan,
  loadSessions,
  statusForDay,
  type DayStatus,
} from "./plan";
import { refreshDerivedAttention } from "./attention";
import { firstName } from "./patient";

/** Patients this clinician may see: whole clinic for admins, assigned patients otherwise. */
export async function accessiblePatientIds(clinician: Clinician) {
  if (clinician.role === "admin") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, clinician.orgId), eq(users.role, "patient")));
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ id: careRelationships.patientId })
    .from(careRelationships)
    .innerJoin(users, eq(users.id, careRelationships.patientId))
    .where(
      and(eq(careRelationships.clinicianId, clinician.id), isNull(careRelationships.endedAt), eq(users.orgId, clinician.orgId)),
    );
  return rows.map((r) => r.id);
}

export type PatientRow = Awaited<ReturnType<typeof listPatients>>[number];

export async function listPatients(clinician: Clinician) {
  const ids = await accessiblePatientIds(clinician);
  if (ids.length === 0) return [];
  await refreshDerivedAttention(db, ids);

  const people = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      timezone: users.timezone,
      passwordHash: users.passwordHash,
      dischargedAt: users.dischargedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(inArray(users.id, ids))
    .orderBy(asc(users.name));

  const attention = await db
    .select({
      patientId: attentionItems.patientId,
      id: attentionItems.id,
      kind: attentionItems.kind,
      message: attentionItems.message,
      createdAt: attentionItems.createdAt,
    })
    .from(attentionItems)
    .where(and(inArray(attentionItems.patientId, ids), isNull(attentionItems.resolvedAt)))
    .orderBy(desc(attentionItems.createdAt));

  const unread = await db
    .select({ patientId: messages.patientId, n: count() })
    .from(messages)
    .where(and(inArray(messages.patientId, ids), isNull(messages.readAt), sql`${messages.senderId} = ${messages.patientId}`))
    .groupBy(messages.patientId);
  const unreadBy = new Map(unread.map((u) => [u.patientId, Number(u.n)]));

  const rows = [];
  for (const person of people) {
    const today = todayIn(person.timezone);
    const plan = await loadPatientPlan(db, person.id);
    const records = await loadSessions(db, person.id, addDays(today, -60), today);
    const byDate = new Map(records.map((r) => [r.scheduledDate, r]));
    const week = weekDates(today);
    let scheduled = 0;
    let done = 0;
    for (const date of week) {
      if (date > today) {
        if (itemsForDate(plan, date).length) scheduled++;
        continue;
      }
      const status = statusForDay(plan, date, today, byDate.get(date));
      if (!["rest", "before_start"].includes(status)) scheduled++;
      if (status === "completed" || status === "partial") done++;
    }
    const last = records.find((r) => r.status === "completed" || r.status === "partially_completed" || r.status === "in_progress");
    const active = currentVersions(plan, today);
    const items = attention.filter((a) => a.patientId === person.id);

    // Recent adherence: last 14 days of scheduled sessions.
    let recentScheduled = 0;
    let recentDone = 0;
    for (let i = 1; i <= 14; i++) {
      const date = addDays(today, -i);
      const status = statusForDay(plan, date, today, byDate.get(date));
      if (!["rest", "before_start"].includes(status)) recentScheduled++;
      if (status === "completed" || status === "partial") recentDone++;
    }

    rows.push({
      id: person.id,
      name: person.name,
      firstName: firstName(person.name),
      email: person.email.endsWith("@invite.form.local") ? null : person.email,
      invitePending: !person.passwordHash,
      discharged: Boolean(person.dischargedAt),
      programTitle: active.map((a) => a.version!.title).join(" + ") || null,
      hasProgram: active.length > 0,
      lastSession: last ? { date: last.scheduledDate, label: relativeDay(last.scheduledDate, today) } : null,
      week: { done, scheduled },
      recent: { done: recentDone, scheduled: recentScheduled },
      attention: items.map((i) => ({ id: i.id, kind: i.kind, message: i.message, createdAt: i.createdAt })),
      unreadMessages: unreadBy.get(person.id) ?? 0,
    });
  }
  return rows;
}

export async function getDashboard(clinician: Clinician) {
  const patients = await listPatients(clinician);
  const ids = patients.map((p) => p.id);
  const attention = ids.length
    ? await db
        .select({
          id: attentionItems.id,
          kind: attentionItems.kind,
          message: attentionItems.message,
          createdAt: attentionItems.createdAt,
          patientId: attentionItems.patientId,
          patientName: users.name,
          exerciseName: exercises.name,
        })
        .from(attentionItems)
        .innerJoin(users, eq(users.id, attentionItems.patientId))
        .leftJoin(exercises, eq(exercises.id, attentionItems.exerciseId))
        .where(and(inArray(attentionItems.patientId, ids), isNull(attentionItems.resolvedAt)))
        .orderBy(desc(attentionItems.createdAt))
    : [];

  // Group by patient: one line per person, newest signal first.
  const byPatient = new Map<string, { patientId: string; patientName: string; items: typeof attention }>();
  for (const item of attention) {
    const entry = byPatient.get(item.patientId) ?? { patientId: item.patientId, patientName: item.patientName, items: [] };
    entry.items.push(item);
    byPatient.set(item.patientId, entry);
  }
  const severity = (kind: string) => (kind === "pain" ? 0 : kind === "skipped_symptoms" ? 1 : kind === "hard_repeat" ? 2 : 3);
  const groups = [...byPatient.values()].sort(
    (a, b) => Math.min(...a.items.map((i) => severity(i.kind))) - Math.min(...b.items.map((i) => severity(i.kind))),
  );

  const unreadThreads = patients.filter((p) => p.unreadMessages > 0);
  const today = todayIn(clinician.timezone);
  return {
    firstName: firstName(clinician.name),
    today,
    todayLabel: formatDay(today, { weekday: "long", month: "long", day: "numeric" }),
    attention: groups.map((g) => ({
      ...g,
      items: g.items.map((i) => ({ ...i, ago: timeAgo(i.createdAt) })),
    })),
    patients,
    unreadThreads,
    stats: {
      active: patients.filter((p) => !p.discharged).length,
      noProgram: patients.filter((p) => !p.hasProgram && !p.discharged).length,
      invitePending: patients.filter((p) => p.invitePending && !p.discharged).length,
    },
  };
}

export type ActivityDay = { date: ISODate; label: string; status: DayStatus; isToday: boolean };

export async function getPatientDetail(clinician: Clinician, patientId: string) {
  const [patient] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      timezone: users.timezone,
      passwordHash: users.passwordHash,
      dischargedAt: users.dischargedAt,
      onboardedAt: users.onboardedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, patientId))
    .limit(1);
  if (!patient) return null;
  await refreshDerivedAttention(db, [patientId]);

  const today = todayIn(patient.timezone);
  const plan = await loadPatientPlan(db, patientId);
  const records = await loadSessions(db, patientId, addDays(today, -90), today);
  const byDate = new Map(records.map((r) => [r.scheduledDate, r]));

  // Activity: 4 weeks, Monday-first rows.
  const firstMonday = addDays(startOfWeek(today), -21);
  const activity: ActivityDay[][] = [];
  for (let w = 0; w < 4; w++) {
    const row: ActivityDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstMonday, w * 7 + d);
      row.push({
        date,
        label: WEEKDAYS_SHORT[new Date(`${date}T00:00:00Z`).getUTCDay()],
        status: statusForDay(plan, date, today, byDate.get(date)),
        isToday: date === today,
      });
    }
    activity.push(row);
  }
  const thisWeek = activity[3];
  const weekScheduled = thisWeek.filter((d) => !["rest", "before_start"].includes(d.status)).length;
  const weekDone = thisWeek.filter((d) => d.status === "completed" || d.status === "partial").length;

  const active = currentVersions(plan, today);
  const programIds = plan.programs.map((p) => p.id);
  const versionRows = programIds.length
    ? await db
        .select({
          id: programVersions.id,
          programId: programVersions.programId,
          version: programVersions.version,
          title: programVersions.title,
          days: programVersions.days,
          note: programVersions.note,
          effectiveFrom: programVersions.effectiveFrom,
          changeSummary: programVersions.changeSummary,
          createdAt: programVersions.createdAt,
          createdByName: users.name,
        })
        .from(programVersions)
        .innerJoin(users, eq(users.id, programVersions.createdById))
        .where(inArray(programVersions.programId, programIds))
        .orderBy(desc(programVersions.version))
    : [];

  const recentFeedback = await db
    .select({
      id: feedback.id,
      rating: feedback.rating,
      note: feedback.note,
      painLocation: feedback.painLocation,
      createdAt: feedback.createdAt,
      reviewedAt: feedback.reviewedAt,
      exerciseId: feedback.exerciseId,
      exerciseName: exercises.name,
      lineageId: feedback.lineageId,
    })
    .from(feedback)
    .innerJoin(exercises, eq(exercises.id, feedback.exerciseId))
    .where(and(eq(feedback.patientId, patientId), gte(feedback.createdAt, new Date(Date.now() - 30 * 86_400_000))))
    .orderBy(desc(feedback.createdAt))
    .limit(60);

  // Per prescribed exercise: the last few ratings (shown next to the program).
  const ratingsByLineage = new Map<string, { rating: string; date: Date }[]>();
  for (const f of recentFeedback) {
    const list = ratingsByLineage.get(f.lineageId) ?? [];
    if (list.length < 5) list.push({ rating: f.rating, date: f.createdAt });
    ratingsByLineage.set(f.lineageId, list);
  }

  const attention = await db
    .select({
      id: attentionItems.id,
      kind: attentionItems.kind,
      message: attentionItems.message,
      createdAt: attentionItems.createdAt,
      exerciseId: attentionItems.exerciseId,
    })
    .from(attentionItems)
    .where(and(eq(attentionItems.patientId, patientId), isNull(attentionItems.resolvedAt)))
    .orderBy(desc(attentionItems.createdAt));

  const notes = await db
    .select({ id: clinicianNotes.id, body: clinicianNotes.body, createdAt: clinicianNotes.createdAt, authorName: users.name })
    .from(clinicianNotes)
    .innerJoin(users, eq(users.id, clinicianNotes.authorId))
    .where(eq(clinicianNotes.patientId, patientId))
    .orderBy(desc(clinicianNotes.createdAt));

  const team = await db
    .select({ id: users.id, name: users.name, credentials: users.credentials })
    .from(careRelationships)
    .innerJoin(users, eq(users.id, careRelationships.clinicianId))
    .where(and(eq(careRelationships.patientId, patientId), isNull(careRelationships.endedAt)));

  const [lastClinicianMessage] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.patientId, patientId), ne(messages.senderId, patientId)))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  const lastTouch = [lastClinicianMessage?.createdAt, versionRows[0]?.createdAt, notes[0]?.createdAt]
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const [{ unread }] = await db
    .select({ unread: count() })
    .from(messages)
    .where(and(eq(messages.patientId, patientId), eq(messages.senderId, patientId), isNull(messages.readAt)));

  const pendingInvite = !patient.passwordHash
    ? (
        await db
          .select({ id: invitations.id, expiresAt: invitations.expiresAt })
          .from(invitations)
          .where(and(eq(invitations.userId, patientId), isNull(invitations.acceptedAt)))
          .orderBy(desc(invitations.createdAt))
          .limit(1)
      )[0] ?? null
    : null;

  const lastSession = records.find((r) => ["completed", "partially_completed", "in_progress"].includes(r.status));

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      firstName: firstName(patient.name),
      email: patient.email.endsWith("@invite.form.local") ? null : patient.email,
      invitePending: !patient.passwordHash,
      discharged: Boolean(patient.dischargedAt),
      since: formatDay(patient.createdAt.toISOString().slice(0, 10), { month: "short", year: "numeric" }),
      timezone: patient.timezone,
    },
    today,
    team,
    pendingInvite,
    status: {
      lastSession: lastSession ? relativeDay(lastSession.scheduledDate, today) : null,
      weekDone,
      weekScheduled,
      painReports: recentFeedback.filter((f) => f.rating === "painful" && f.createdAt.getTime() > Date.now() - 14 * 86_400_000).length,
      lastTouch: lastTouch ? timeAgo(lastTouch) : null,
    },
    attention: attention.map((a) => ({ ...a, ago: timeAgo(a.createdAt) })),
    programs: active.map(({ program, version, items }) => {
      const meta = versionRows.find((v) => v.id === version!.id);
      return {
        id: program.id,
        title: version!.title,
        startDate: program.startDate,
        startLabel: formatDay(program.startDate),
        days: version!.days,
        note: meta?.note ?? null,
        version: version!.version,
        updatedAgo: meta ? timeAgo(meta.createdAt) : null,
        minutes: estimateMinutes(items.map((i) => ({ ...i, secondsPerSet: i.exercise.secondsPerSet }))),
        items: items.map((item) => ({
          ...item,
          recentRatings: ratingsByLineage.get(item.lineageId) ?? [],
        })),
        versions: versionRows
          .filter((v) => v.programId === program.id)
          .map((v) => ({
            id: v.id,
            version: v.version,
            dateLabel: formatDay(v.createdAt.toISOString().slice(0, 10)),
            createdByName: v.createdByName,
            changeSummary: v.changeSummary,
          })),
      };
    }),
    pastPrograms: plan.programs
      .filter((p) => !active.some((a) => a.program.id === p.id))
      .map((p) => ({ id: p.id, title: p.title, startLabel: formatDay(p.startDate), endLabel: p.endDate ? formatDay(p.endDate) : null })),
    feedback: recentFeedback.map((f) => ({ ...f, ago: timeAgo(f.createdAt) })),
    activity,
    notes: notes.map((n) => ({ ...n, ago: timeAgo(n.createdAt) })),
    unreadMessages: Number(unread),
  };
}

export type PatientDetail = NonNullable<Awaited<ReturnType<typeof getPatientDetail>>>;

/** Exercise library visible to a clinic: FORM's approved library + the clinic's own. */
export async function getLibrary(orgId: string) {
  const rows = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.isActive, true), or(isNull(exercises.orgId), eq(exercises.orgId, orgId))))
    .orderBy(asc(exercises.name));
  const summaries = await loadExerciseSummaries(
    db,
    rows.map((r) => r.id),
    orgId,
  );
  const full = await db
    .select({
      id: exercises.id,
      categories: exercises.categories,
      movementPatterns: exercises.movementPatterns,
      tags: exercises.tags,
      difficulty: exercises.difficulty,
      lateralitySupported: exercises.lateralitySupported,
      defaultSets: exercises.defaultSets,
      defaultReps: exercises.defaultReps,
      defaultDurationSec: exercises.defaultDurationSec,
      defaultPerSide: exercises.defaultPerSide,
    })
    .from(exercises)
    .where(inArray(exercises.id, rows.map((r) => r.id)));
  const extra = new Map(full.map((f) => [f.id, f]));
  const relations = await db.execute<{ exercise_id: string; related_id: string; kind: "progression" | "regression" }>(
    sql`select exercise_id, related_id, kind from exercise_relations`,
  );
  return rows.map((r) => {
    const s = summaries.get(r.id)!;
    const e = extra.get(r.id)!;
    return {
      ...s,
      ...e,
      progressionIds: relations.rows.filter((x) => x.exercise_id === r.id && x.kind === "progression").map((x) => x.related_id),
      regressionIds: relations.rows.filter((x) => x.exercise_id === r.id && x.kind === "regression").map((x) => x.related_id),
    };
  });
}

export type LibraryExercise = Awaited<ReturnType<typeof getLibrary>>[number];

export async function listTemplates(orgId: string) {
  const rows = await db
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
      days: templates.days,
      updatedAt: templates.updatedAt,
      count: count(templateExercises.id),
    })
    .from(templates)
    .leftJoin(templateExercises, eq(templateExercises.templateId, templates.id))
    .where(eq(templates.orgId, orgId))
    .groupBy(templates.id)
    .orderBy(asc(templates.name));
  const items = rows.length
    ? await db
        .select({
          templateId: templateExercises.templateId,
          exerciseId: templateExercises.exerciseId,
          name: exercises.name,
          sets: templateExercises.sets,
          reps: templateExercises.reps,
          durationSec: templateExercises.durationSec,
          perSide: templateExercises.perSide,
          side: templateExercises.side,
          days: templateExercises.days,
          note: templateExercises.note,
          position: templateExercises.position,
          secondsPerSet: exercises.secondsPerSet,
        })
        .from(templateExercises)
        .innerJoin(exercises, eq(exercises.id, templateExercises.exerciseId))
        .where(inArray(templateExercises.templateId, rows.map((r) => r.id)))
        .orderBy(asc(templateExercises.position))
    : [];
  return rows.map((r) => {
    const mine = items.filter((i) => i.templateId === r.id);
    return {
      ...r,
      count: Number(r.count),
      minutes: estimateMinutes(mine),
      updatedAgo: timeAgo(r.updatedAt),
      items: mine,
    };
  });
}

export type TemplateSummary = Awaited<ReturnType<typeof listTemplates>>[number];

export async function listClinicians(orgId: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, credentials: users.credentials, active: sql<boolean>`${users.passwordHash} is not null` })
    .from(users)
    .where(and(eq(users.orgId, orgId), inArray(users.role, ["clinician", "admin"])))
    .orderBy(asc(users.name));
}

export async function getProgramForBuilder(clinician: Clinician, patientId: string, programId: string | null) {
  if (!programId) return null;
  const [program] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, programId), eq(programs.patientId, patientId), eq(programs.orgId, clinician.orgId)))
    .limit(1);
  if (!program || !program.currentVersionId) return null;
  const plan = await loadPatientPlan(db, patientId);
  const version = plan.versions.find((v) => v.id === program.currentVersionId)!;
  const [meta] = await db
    .select({ note: programVersions.note })
    .from(programVersions)
    .where(eq(programVersions.id, version.id));
  const items = plan.itemsByVersion.get(version.id) ?? [];
  return {
    programId: program.id,
    version: version.version,
    draft: {
      title: version.title,
      days: version.days,
      note: meta?.note ?? null,
      items: items.map((item) => ({
        lineageId: item.lineageId,
        exerciseId: item.exercise.id,
        sets: item.sets,
        reps: item.reps,
        durationSec: item.durationSec,
        perSide: item.perSide,
        side: item.side,
        days: item.days,
        note: item.note,
      })),
    },
  };
}

/** Remembered builder defaults (e.g. the schedule this clinician usually prescribes). */
export async function getClinicianPreferences(userId: string) {
  const [row] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).limit(1);
  return { defaultDays: row?.preferences?.defaultDays ?? [1, 3, 5] };
}
