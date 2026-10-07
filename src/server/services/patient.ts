import { and, asc, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "../db";
import {
  careRelationships,
  exerciseCompletions,
  exercises,
  feedback,
  messages,
  notifications,
  programVersions,
  sessions,
  users,
} from "../db/schema";
import {
  addDays,
  diffDays,
  formatDay,
  greeting,
  hourIn,
  relativeDay,
  startOfWeek,
  todayIn,
  weekDates,
  WEEKDAYS_SHORT,
  type ISODate,
} from "@/lib/dates";
import { estimateMinutes } from "@/lib/dosage";
import {
  currentVersions,
  itemsForDate,
  loadPatientPlan,
  loadSessionDetail,
  loadSessions,
  nextScheduledDate,
  statusForDay,
  type DayStatus,
  type PatientPlan,
  type PlanItem,
  type SessionRecord,
} from "./plan";
import type { CurrentUser } from "../auth/session";

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export type TodayItem = PlanItem & { done: boolean; completionId: string | null };

export type WeekDay = { date: ISODate; label: string; status: DayStatus; isToday: boolean };

export type TodayState =
  | "no_program"
  | "future"
  | "not_started"
  | "in_progress"
  | "complete"
  | "partial"
  | "skipped"
  | "rest"
  | "discharged";

export async function getCareTeam(patientId: string) {
  return db
    .select({ id: users.id, name: users.name, credentials: users.credentials, isPrimary: careRelationships.isPrimary })
    .from(careRelationships)
    .innerJoin(users, eq(users.id, careRelationships.clinicianId))
    .where(and(eq(careRelationships.patientId, patientId), isNull(careRelationships.endedAt)))
    .orderBy(desc(careRelationships.isPrimary), asc(users.name));
}

function buildWeek(plan: PatientPlan, today: ISODate, byDate: Map<string, SessionRecord>): WeekDay[] {
  return weekDates(today).map((date) => ({
    date,
    label: WEEKDAYS_SHORT[new Date(`${date}T00:00:00Z`).getUTCDay()],
    status: statusForDay(plan, date, today, byDate.get(date)),
    isToday: date === today,
  }));
}

export async function getToday(user: CurrentUser) {
  const today = todayIn(user.timezone);
  const plan = await loadPatientPlan(db, user.id);
  const recent = await loadSessions(db, user.id, addDays(today, -13), addDays(today, 7));
  const byDate = new Map(recent.map((s) => [s.scheduledDate, s]));
  const todaysSession = byDate.get(today);
  const team = await getCareTeam(user.id);
  const clinician = team[0] ?? null;

  let items: TodayItem[];
  if (todaysSession && todaysSession.status !== "skipped") {
    const detail = await loadSessionDetail(db, todaysSession.id, plan);
    items = detail.map((d) => ({ ...d, done: Boolean(d.completionId) }));
  } else {
    items = itemsForDate(plan, today).map((item) => ({ ...item, done: false, completionId: null }));
  }

  const doneCount = items.filter((i) => i.done).length;
  const activePrograms = currentVersions(plan, today);
  const futureStart = plan.programs
    .filter((p) => p.status === "active" && p.startDate > today)
    .map((p) => p.startDate)
    .sort()[0];

  let state: TodayState;
  if (user.dischargedAt) state = "discharged";
  else if (plan.programs.length === 0 || (activePrograms.length === 0 && !futureStart)) state = "no_program";
  else if (todaysSession?.status === "skipped") state = "skipped";
  else if (todaysSession?.status === "completed") state = "complete";
  else if (todaysSession?.status === "partially_completed") state = "partial";
  else if (todaysSession?.status === "in_progress") state = doneCount === items.length && items.length > 0 ? "complete" : "in_progress";
  else if (items.length > 0) state = "not_started";
  else if (futureStart && activePrograms.every((p) => p.program.startDate > today)) state = "future";
  else state = "rest";

  const next = nextScheduledDate(plan, today);
  const week = buildWeek(plan, today, byDate);
  const weekScheduled = week.filter((d) => !["rest", "before_start"].includes(d.status)).length;
  const weekDone = week.filter((d) => d.status === "completed" || d.status === "partial").length;

  // The most recent missed day in the last 3 days that the patient hasn't told us about.
  let pendingMissed: { date: ISODate; label: string } | null = null;
  for (let i = 1; i <= 3; i++) {
    const date = addDays(today, -i);
    if (statusForDay(plan, date, today, byDate.get(date)) === "missed") {
      pendingMissed = { date, label: relativeDay(date, today) };
      break;
    }
  }

  const updates = await db
    .select({ id: notifications.id, body: notifications.body, kind: notifications.kind, createdAt: notifications.createdAt })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, user.id),
        isNull(notifications.readAt),
        inArray(notifications.kind, ["plan_updated", "plan_assigned"]),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);

  const [{ unread }] = await db
    .select({ unread: count() })
    .from(messages)
    .where(and(eq(messages.patientId, user.id), isNull(messages.readAt), ne(messages.senderId, user.id)));

  return {
    today,
    greeting: greeting(hourIn(user.timezone)),
    firstName: firstName(user.name),
    state,
    sessionId: todaysSession?.id ?? null,
    items,
    doneCount,
    totalCount: items.length,
    minutes: estimateMinutes(items.map((i) => ({ ...i, secondsPerSet: i.exercise.secondsPerSet }))),
    remainingMinutes: estimateMinutes(
      items.filter((i) => !i.done).map((i) => ({ ...i, secondsPerSet: i.exercise.secondsPerSet })),
    ),
    durationSec: todaysSession?.durationSec ?? null,
    next: next
      ? {
          date: next.date,
          label: relativeDay(next.date, today),
          count: next.items.length,
          minutes: estimateMinutes(next.items.map((i) => ({ ...i, secondsPerSet: i.exercise.secondsPerSet }))),
        }
      : null,
    futureStart: futureStart ? { date: futureStart, label: relativeDay(futureStart, today) } : null,
    week,
    weekDone,
    weekScheduled,
    pendingMissed,
    update: updates[0] ?? null,
    unreadMessages: Number(unread),
    clinician: clinician ? { ...clinician, firstName: firstName(clinician.name) } : null,
    multiplePrograms: activePrograms.length > 1,
  };
}

export type TodayView = Awaited<ReturnType<typeof getToday>>;

export async function getProgress(user: CurrentUser) {
  const today = todayIn(user.timezone);
  const plan = await loadPatientPlan(db, user.id);
  const earliest = plan.programs.map((p) => p.startDate).sort()[0] ?? today;
  const from = earliest < addDays(today, -7 * 12) ? addDays(today, -7 * 12) : earliest;
  const records = await loadSessions(db, user.id, from, today);
  const byDate = new Map(records.map((s) => [s.scheduledDate, s]));

  const [{ total: exercisesCompleted }] = await db
    .select({ total: count() })
    .from(exerciseCompletions)
    .innerJoin(sessions, eq(sessions.id, exerciseCompletions.sessionId))
    .where(eq(sessions.patientId, user.id));

  const [{ total: sessionsCompleted }] = await db
    .select({ total: count() })
    .from(sessions)
    .where(and(eq(sessions.patientId, user.id), inArray(sessions.status, ["completed", "partially_completed"])));

  // Weekly consistency: last 8 weeks (or since start).
  const thisMonday = startOfWeek(today);
  const weeks: { start: ISODate; label: string; done: number; scheduled: number; current: boolean }[] = [];
  for (let w = 7; w >= 0; w--) {
    const start = addDays(thisMonday, -7 * w);
    if (addDays(start, 6) < earliest) continue;
    let done = 0;
    let scheduled = 0;
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, d);
      const status = statusForDay(plan, date, today, byDate.get(date));
      if (status === "completed" || status === "partial") done++;
      if (!["rest", "before_start"].includes(status)) scheduled++;
    }
    weeks.push({ start, label: formatDay(start), done, scheduled, current: w === 0 });
  }

  // History: completed / partial / skipped / missed days, newest first.
  const history: { date: ISODate; label: string; status: DayStatus; exercises: number; durationSec: number | null }[] = [];
  const completionCounts = records.length
    ? await db
        .select({ sessionId: exerciseCompletions.sessionId, n: count() })
        .from(exerciseCompletions)
        .where(inArray(exerciseCompletions.sessionId, records.map((r) => r.id)))
        .groupBy(exerciseCompletions.sessionId)
    : [];
  const countBySession = new Map(completionCounts.map((c) => [c.sessionId, Number(c.n)]));
  for (let d = today; d >= from && history.length < 30; d = addDays(d, -1)) {
    const session = byDate.get(d);
    const status = statusForDay(plan, d, today, session);
    if (["rest", "before_start", "scheduled", "today"].includes(status)) continue;
    history.push({
      date: d,
      label: relativeDay(d, today),
      status,
      exercises: session ? countBySession.get(session.id) ?? 0 : 0,
      durationSec: session?.durationSec ?? null,
    });
  }

  const current = weeks.find((w) => w.current);
  const daysSinceStart = Math.max(0, diffDays(today, earliest));

  return {
    today,
    sessionsCompleted: Number(sessionsCompleted),
    exercisesCompleted: Number(exercisesCompleted),
    thisWeek: current ? { done: current.done, scheduled: current.scheduled } : { done: 0, scheduled: 0 },
    weeks,
    history,
    weeksIn: Math.floor(daysSinceStart / 7) + 1,
    hasProgram: plan.programs.length > 0,
    week: buildWeek(plan, today, byDate),
  };
}

export async function getProgramView(user: CurrentUser) {
  const today = todayIn(user.timezone);
  const plan = await loadPatientPlan(db, user.id);
  const entries = currentVersions(plan, today);
  const versionIds = entries.map((e) => e.version!.id);
  const versionMeta = versionIds.length
    ? await db
        .select({
          id: programVersions.id,
          version: programVersions.version,
          note: programVersions.note,
          changeSummary: programVersions.changeSummary,
          createdAt: programVersions.createdAt,
          createdByName: users.name,
        })
        .from(programVersions)
        .innerJoin(users, eq(users.id, programVersions.createdById))
        .where(inArray(programVersions.id, versionIds))
    : [];
  const metaById = new Map(versionMeta.map((m) => [m.id, m]));

  return {
    today,
    week: weekDates(today).map((date) => ({
      date,
      label: WEEKDAYS_SHORT[new Date(`${date}T00:00:00Z`).getUTCDay()],
      isToday: date === today,
      items: itemsForDate(plan, date),
    })),
    programs: entries.map(({ program, version, items }) => {
      const meta = metaById.get(version!.id);
      return {
        id: program.id,
        title: version!.title,
        startDate: program.startDate,
        startLabel: formatDay(program.startDate, { month: "short", day: "numeric", year: "numeric" }),
        endDate: program.endDate,
        startsInFuture: program.startDate > today,
        clinicianName: program.clinicianName,
        clinicianCredentials: program.clinicianCredentials,
        days: version!.days,
        version: version!.version,
        note: meta?.note ?? null,
        updatedAt: meta?.createdAt ?? null,
        updatedBy: meta?.createdByName ?? null,
        changeSummary: meta?.changeSummary ?? [],
        items,
      };
    }),
  };
}

export async function getThread(patientId: string) {
  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      readAt: messages.readAt,
      senderId: messages.senderId,
      senderName: users.name,
      senderRole: users.role,
      senderCredentials: users.credentials,
      exerciseId: messages.exerciseId,
      exerciseName: exercises.name,
      feedbackId: messages.feedbackId,
      rating: feedback.rating,
      painLocation: feedback.painLocation,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .leftJoin(exercises, eq(exercises.id, messages.exerciseId))
    .leftJoin(feedback, eq(feedback.id, messages.feedbackId))
    .where(eq(messages.patientId, patientId))
    .orderBy(asc(messages.createdAt))
    .limit(300);
  return rows;
}

export type ThreadMessage = Awaited<ReturnType<typeof getThread>>[number];
