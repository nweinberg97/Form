"use server";

import { revalidatePath } from "next/cache";
import { and, asc, count, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  exerciseCompletions,
  feedback,
  messages,
  notifications,
  programExercises,
  sessionItems,
  sessions,
  users,
  exercises,
} from "../db/schema";
import { requirePatient } from "../auth/guards";
import { run, UserFacingError } from "./result";
import { itemsForDate, loadPatientPlan } from "../services/plan";
import { addDays, diffDays, isValidTimeZone, todayIn, WEEKDAYS_LONG, weekday } from "@/lib/dates";
import { track } from "../services/events";
import { SKIP_REASON_LABEL } from "@/lib/labels";
import { checkRepeat, raiseAttention } from "../services/attention";

const uuid = z.string().uuid();

function revalidatePatient() {
  revalidatePath("/app", "layout");
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

/**
 * Starts (or resumes) today's session. The plan is frozen into session_items,
 * so a clinician editing the program mid-session never changes it.
 * Idempotent: calling twice returns the same session.
 */
export async function startSession() {
  return run(async () => {
    const user = await requirePatient();
    const today = todayIn(user.timezone);
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: sessions.id, status: sessions.status })
        .from(sessions)
        .where(and(eq(sessions.patientId, user.id), eq(sessions.scheduledDate, today)))
        .limit(1);

      if (existing && existing.status !== "skipped") return { sessionId: existing.id };

      const plan = await loadPatientPlan(tx, user.id);
      const items = itemsForDate(plan, today);
      if (items.length === 0) throw new UserFacingError("Nothing is prescribed for today.");

      let sessionId: string;
      if (existing) {
        // The patient changed their mind after skipping — reopen the day.
        await tx
          .update(sessions)
          .set({ status: "in_progress", startedAt: new Date(), skipReason: null, skipNote: null })
          .where(eq(sessions.id, existing.id));
        await tx.delete(sessionItems).where(eq(sessionItems.sessionId, existing.id));
        sessionId = existing.id;
      } else {
        const [created] = await tx
          .insert(sessions)
          .values({ patientId: user.id, scheduledDate: today, status: "in_progress", startedAt: new Date() })
          .onConflictDoNothing()
          .returning({ id: sessions.id });
        if (!created) {
          const [raced] = await tx
            .select({ id: sessions.id })
            .from(sessions)
            .where(and(eq(sessions.patientId, user.id), eq(sessions.scheduledDate, today)));
          return { sessionId: raced.id };
        }
        sessionId = created.id;
      }

      await tx.insert(sessionItems).values(
        items.map((item, index) => ({ sessionId, programExerciseId: item.programExerciseId, position: index })),
      );
      await track(tx, user.id, "patient_session_started", { exercises: items.length });
      return { sessionId };
    });
  });
}

async function ownedSession(sessionId: string, patientId: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.patientId, patientId)))
    .limit(1);
  if (!session) throw new UserFacingError("We couldn't find that session.");
  return session;
}

async function settleSession(sessionId: string) {
  const [{ total }] = await db.select({ total: count() }).from(sessionItems).where(eq(sessionItems.sessionId, sessionId));
  const [{ done }] = await db
    .select({ done: count() })
    .from(exerciseCompletions)
    .where(eq(exerciseCompletions.sessionId, sessionId));
  return { total: Number(total), done: Number(done) };
}

const completeSchema = z.object({
  sessionId: uuid,
  programExerciseId: uuid,
  setsCompleted: z.number().int().min(0).max(20).optional(),
});

/** Marks one exercise complete. Safe to retry: duplicates are ignored. */
export async function completeExercise(input: z.infer<typeof completeSchema>) {
  return run(async () => {
    const user = await requirePatient();
    const data = completeSchema.parse(input);
    const session = await ownedSession(data.sessionId, user.id);

    const [item] = await db
      .select({
        programExerciseId: sessionItems.programExerciseId,
        exerciseId: programExercises.exerciseId,
        lineageId: programExercises.lineageId,
        sets: programExercises.sets,
      })
      .from(sessionItems)
      .innerJoin(programExercises, eq(programExercises.id, sessionItems.programExerciseId))
      .where(and(eq(sessionItems.sessionId, session.id), eq(sessionItems.programExerciseId, data.programExerciseId)))
      .limit(1);
    if (!item) throw new UserFacingError("That exercise isn't part of this session.");

    await db
      .insert(exerciseCompletions)
      .values({
        sessionId: session.id,
        programExerciseId: item.programExerciseId,
        exerciseId: item.exerciseId,
        lineageId: item.lineageId,
        setsCompleted: data.setsCompleted ?? item.sets,
      })
      .onConflictDoNothing();
    const [completion] = await db
      .select({ id: exerciseCompletions.id })
      .from(exerciseCompletions)
      .where(and(eq(exerciseCompletions.sessionId, session.id), eq(exerciseCompletions.programExerciseId, item.programExerciseId)));

    const { total, done } = await settleSession(session.id);
    let status = session.status;
    if (done >= total && session.status !== "completed") {
      const completedAt = new Date();
      const durationSec = session.startedAt
        ? Math.min(4 * 3600, Math.max(60, Math.round((completedAt.getTime() - session.startedAt.getTime()) / 1000)))
        : null;
      await db
        .update(sessions)
        .set({ status: "completed", completedAt, durationSec })
        .where(eq(sessions.id, session.id));
      status = "completed";
      await track(db, user.id, "session_completed", { exercises: total, durationSec });
    } else if (session.status === "partially_completed" || session.status === "skipped") {
      await db.update(sessions).set({ status: "in_progress" }).where(eq(sessions.id, session.id));
      status = "in_progress";
    }
    await track(db, user.id, "exercise_completed", { exerciseId: item.exerciseId });
    revalidatePatient();
    return { completionId: completion.id, done, total, status };
  });
}

const feedbackSchema = z.object({
  completionId: uuid,
  rating: z.enum(["easy", "good", "hard", "painful"]),
  painLocation: z.string().trim().max(80).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

/**
 * Records how an exercise felt. Re-submitting replaces the previous answer.
 * A note becomes a message in the care thread, attached to the exercise.
 * Pain raises an attention item for the clinician — stated, not interpreted.
 */
export async function submitFeedback(input: z.infer<typeof feedbackSchema>) {
  return run(async () => {
    const user = await requirePatient();
    const data = feedbackSchema.parse(input);
    const [completion] = await db
      .select({
        id: exerciseCompletions.id,
        exerciseId: exerciseCompletions.exerciseId,
        lineageId: exerciseCompletions.lineageId,
        exerciseName: exercises.name,
      })
      .from(exerciseCompletions)
      .innerJoin(sessions, eq(sessions.id, exerciseCompletions.sessionId))
      .innerJoin(exercises, eq(exercises.id, exerciseCompletions.exerciseId))
      .where(and(eq(exerciseCompletions.id, data.completionId), eq(sessions.patientId, user.id)))
      .limit(1);
    if (!completion) throw new UserFacingError("We couldn't find that exercise.");

    const note = data.note || null;
    const painLocation = data.rating === "painful" ? data.painLocation || null : null;

    const [row] = await db
      .insert(feedback)
      .values({
        completionId: completion.id,
        patientId: user.id,
        exerciseId: completion.exerciseId,
        lineageId: completion.lineageId,
        rating: data.rating,
        painLocation,
        note,
      })
      .onConflictDoUpdate({
        target: feedback.completionId,
        set: { rating: data.rating, painLocation, note, createdAt: new Date(), reviewedAt: null },
      })
      .returning({ id: feedback.id });

    if (note) {
      await db
        .insert(messages)
        .values({
          patientId: user.id,
          senderId: user.id,
          body: note,
          exerciseId: completion.exerciseId,
          feedbackId: row.id,
          clientId: `feedback:${row.id}`,
        })
        .onConflictDoUpdate({ target: [messages.senderId, messages.clientId], set: { body: note } });
    }

    if (data.rating === "painful") {
      await raiseAttention(db, {
        orgId: user.orgId,
        patientId: user.id,
        kind: "pain",
        exerciseId: completion.exerciseId,
        message: `Reported pain during ${completion.exerciseName}${painLocation ? ` — ${painLocation.toLowerCase()}` : ""}`,
        dedupeKey: `pain:${row.id}`,
      });
    } else if (note) {
      await raiseAttention(db, {
        orgId: user.orgId,
        patientId: user.id,
        kind: "patient_note",
        exerciseId: completion.exerciseId,
        message: `Left a note on ${completion.exerciseName}`,
        dedupeKey: `note:${row.id}`,
      });
    }
    if (data.rating === "hard" || data.rating === "painful") {
      await checkRepeat(db, {
        rating: data.rating,
        orgId: user.orgId,
        patientId: user.id,
        lineageId: completion.lineageId,
        exerciseId: completion.exerciseId,
        exerciseName: completion.exerciseName,
        timezone: user.timezone,
      });
    }

    await track(db, user.id, "exercise_feedback_submitted", { rating: data.rating, hasNote: Boolean(note) });
    revalidatePatient();
    return { feedbackId: row.id };
  });
}

/** Ends today's session early. What was done stays done. */
export async function finishSession(input: { sessionId: string }) {
  return run(async () => {
    const user = await requirePatient();
    const session = await ownedSession(uuid.parse(input.sessionId), user.id);
    if (session.status === "completed") return { status: "completed" as const };
    const { done, total } = await settleSession(session.id);
    const status = done === 0 ? ("skipped" as const) : done >= total ? ("completed" as const) : ("partially_completed" as const);
    const completedAt = new Date();
    await db
      .update(sessions)
      .set({
        status,
        completedAt: status === "skipped" ? null : completedAt,
        durationSec:
          session.startedAt && status !== "skipped"
            ? Math.min(4 * 3600, Math.round((completedAt.getTime() - session.startedAt.getTime()) / 1000))
            : null,
      })
      .where(eq(sessions.id, session.id));
    revalidatePatient();
    return { status };
  });
}

const skipSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.enum(["unwell", "no_time", "symptoms", "forgot", "other"]).nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

/**
 * "Didn't complete today's plan?" — missing a day is information, not failure.
 * Allowed for today and the previous 7 days, only on scheduled days.
 */
export async function skipDay(input: z.infer<typeof skipSchema>) {
  return run(async () => {
    const user = await requirePatient();
    const data = skipSchema.parse(input);
    const today = todayIn(user.timezone);
    const delta = diffDays(today, data.date);
    if (delta < 0 || delta > 7) throw new UserFacingError("That day can't be updated.");

    const plan = await loadPatientPlan(db, user.id);
    if (itemsForDate(plan, data.date).length === 0) throw new UserFacingError("Nothing was scheduled that day.");

    const [existing] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.patientId, user.id), eq(sessions.scheduledDate, data.date)))
      .limit(1);
    const note = data.note || null;
    if (existing) {
      const { done } = await settleSession(existing.id);
      await db
        .update(sessions)
        .set({ status: done > 0 ? "partially_completed" : "skipped", skipReason: data.reason, skipNote: note })
        .where(eq(sessions.id, existing.id));
    } else {
      await db
        .insert(sessions)
        .values({ patientId: user.id, scheduledDate: data.date, status: "skipped", skipReason: data.reason, skipNote: note })
        .onConflictDoNothing();
    }

    const dayLabel = delta === 0 ? "today's" : delta === 1 ? "yesterday's" : `${WEEKDAYS_LONG[weekday(data.date)]}'s`;
    if (note || data.reason) {
      const reasonText = data.reason ? SKIP_REASON_LABEL[data.reason] : null;
      if (note) {
        await db
          .insert(messages)
          .values({
            patientId: user.id,
            senderId: user.id,
            body: `Skipped ${dayLabel} session${reasonText ? ` · ${reasonText}` : ""}\n\n${note}`,
            clientId: `skip:${data.date}`,
          })
          .onConflictDoNothing();
      }
      if (data.reason === "symptoms" || note) {
        await raiseAttention(db, {
          orgId: user.orgId,
          patientId: user.id,
          kind: data.reason === "symptoms" ? "skipped_symptoms" : "patient_note",
          message:
            data.reason === "symptoms"
              ? `Skipped ${dayLabel} session because of symptoms`
              : `Skipped ${dayLabel} session and left a note`,
          dedupeKey: `skip:${data.date}`,
        });
      }
    }
    await track(db, user.id, "session_missed", { reason: data.reason, daysAgo: delta });
    revalidatePatient();
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Messages & notifications                                            */
/* ------------------------------------------------------------------ */

const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message first.").max(2000),
  clientId: z.string().min(8).max(64),
  exerciseId: uuid.optional().nullable(),
});

export async function sendPatientMessage(input: z.infer<typeof messageSchema>) {
  return run(async () => {
    const user = await requirePatient();
    const data = messageSchema.parse(input);
    await db
      .insert(messages)
      .values({ patientId: user.id, senderId: user.id, body: data.body, exerciseId: data.exerciseId ?? null, clientId: data.clientId })
      .onConflictDoNothing();
    revalidatePatient();
    return { ok: true };
  });
}

export async function markThreadRead() {
  return run(async () => {
    const user = await requirePatient();
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.patientId, user.id), ne(messages.senderId, user.id), isNull(messages.readAt)));
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), eq(notifications.kind, "message"), isNull(notifications.readAt)));
    revalidatePatient();
    return { ok: true };
  });
}

export async function dismissNotification(input: { id: string }) {
  return run(async () => {
    const user = await requirePatient();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, uuid.parse(input.id)), eq(notifications.userId, user.id)));
    revalidatePatient();
    return { ok: true };
  });
}

export async function trackExerciseViewed(input: { exerciseId: string }) {
  const user = await requirePatient().catch(() => null);
  if (!user) return;
  await track(db, user.id, "exercise_viewed", { exerciseId: input.exerciseId });
}

/* ------------------------------------------------------------------ */
/* Profile & onboarding                                                */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(80),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid timezone."),
});

export async function updatePatientProfile(input: z.infer<typeof profileSchema>) {
  return run(async () => {
    const user = await requirePatient();
    const data = profileSchema.parse(input);
    await db.update(users).set({ name: data.name, timezone: data.timezone }).where(eq(users.id, user.id));
    revalidatePatient();
    return { ok: true };
  });
}

const notificationSchema = z.object({
  notifyReminders: z.boolean(),
  notifyMessages: z.boolean(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function updateNotificationPrefs(input: z.infer<typeof notificationSchema>) {
  return run(async () => {
    const user = await requirePatient();
    const data = notificationSchema.parse(input);
    await db.update(users).set(data).where(eq(users.id, user.id));
    revalidatePatient();
    return { ok: true };
  });
}

const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(80),
  notifyReminders: z.boolean(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().refine(isValidTimeZone, "Choose a valid timezone."),
});

export async function completeOnboarding(input: z.infer<typeof onboardingSchema>) {
  return run(async () => {
    const user = await requirePatient();
    const data = onboardingSchema.parse(input);
    await db
      .update(users)
      .set({ ...data, onboardedAt: new Date() })
      .where(eq(users.id, user.id));
    revalidatePatient();
    return { ok: true };
  });
}

/** Used by the session screen after a reload: what has already been completed today. */
export async function getSessionProgress(input: { sessionId: string }) {
  return run(async () => {
    const user = await requirePatient();
    const session = await ownedSession(uuid.parse(input.sessionId), user.id);
    const rows = await db
      .select({ programExerciseId: exerciseCompletions.programExerciseId, completionId: exerciseCompletions.id })
      .from(exerciseCompletions)
      .where(eq(exerciseCompletions.sessionId, session.id))
      .orderBy(asc(exerciseCompletions.completedAt));
    return { status: session.status, completed: rows };
  });
}
