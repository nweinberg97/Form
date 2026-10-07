"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  attentionItems,
  careRelationships,
  clinicianNotes,
  exerciseMedia,
  exercises,
  feedback,
  invitations,
  messages,
  programs,
  templateExercises,
  templates,
  users,
} from "../db/schema";
import { assertCanAccessPatient, requireAdmin, requireClinician } from "../auth/guards";
import { randomToken, sha256 } from "../auth/password";
import { run, UserFacingError } from "./result";
import { draftSchema, writeProgramVersion } from "../services/programs";
import { audit, notify, track } from "../services/events";
import { resolveAttention } from "../services/attention";
import { todayIn } from "@/lib/dates";
import { firstName } from "../services/patient";
import { parseYouTubeId } from "@/lib/youtube";

const uuid = z.string().uuid();

function revalidateClinic(patientId?: string) {
  revalidatePath("/clinic", "layout");
  if (patientId) revalidatePath("/app", "layout");
}

async function originUrl() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

async function createInvite(orgId: string, userId: string, invitedById: string) {
  const code = randomToken(18);
  await db
    .update(invitations)
    .set({ expiresAt: new Date() })
    .where(and(eq(invitations.userId, userId), isNull(invitations.acceptedAt)));
  await db.insert(invitations).values({
    orgId,
    userId,
    invitedById,
    tokenHash: sha256(code),
    expiresAt: new Date(Date.now() + 14 * 86_400_000),
  });
  return `${await originUrl()}/invite/${code}`;
}

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

const createPatientSchema = z.object({
  name: z.string().trim().min(1, "Add the patient's name.").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "That email doesn't look right.")
    .optional(),
});

export async function createPatient(input: z.infer<typeof createPatientSchema>) {
  return run(async () => {
    const clinician = await requireClinician();
    const data = createPatientSchema.parse(input);
    const email = data.email || `pending-${randomToken(9).toLowerCase()}@invite.form.local`;
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (taken) throw new UserFacingError("Someone with that email already has a FORM account.");

    const patientId = await db.transaction(async (tx) => {
      const [patient] = await tx
        .insert(users)
        .values({ orgId: clinician.orgId, email, name: data.name, role: "patient", timezone: clinician.timezone })
        .returning({ id: users.id });
      await tx.insert(careRelationships).values({ patientId: patient.id, clinicianId: clinician.id, isPrimary: true });
      await audit(tx, {
        orgId: clinician.orgId,
        actorId: clinician.id,
        action: "patient.created",
        entityType: "user",
        entityId: patient.id,
        patientId: patient.id,
      });
      return patient.id;
    });
    const inviteUrl = await createInvite(clinician.orgId, patientId, clinician.id);
    revalidateClinic();
    return { patientId, inviteUrl };
  });
}

export async function regenerateInvite(input: { patientId: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const patient = await assertCanAccessPatient(clinician, uuid.parse(input.patientId));
    const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, patient.id));
    if (row?.passwordHash) throw new UserFacingError(`${firstName(patient.name)} has already set up their account.`);
    const inviteUrl = await createInvite(clinician.orgId, patient.id, clinician.id);
    await audit(db, {
      orgId: clinician.orgId,
      actorId: clinician.id,
      action: "patient.invited",
      entityType: "user",
      entityId: patient.id,
      patientId: patient.id,
    });
    return { inviteUrl };
  });
}

export async function dischargePatient(input: { patientId: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const patient = await assertCanAccessPatient(clinician, uuid.parse(input.patientId));
    const today = todayIn(clinician.timezone);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ dischargedAt: new Date() }).where(eq(users.id, patient.id));
      await tx
        .update(programs)
        .set({ status: "completed", endDate: today, updatedAt: new Date() })
        .where(and(eq(programs.patientId, patient.id), eq(programs.status, "active")));
      await tx
        .update(attentionItems)
        .set({ resolvedAt: new Date(), resolvedById: clinician.id })
        .where(and(eq(attentionItems.patientId, patient.id), isNull(attentionItems.resolvedAt)));
      await audit(tx, {
        orgId: clinician.orgId,
        actorId: clinician.id,
        action: "patient.discharged",
        entityType: "user",
        entityId: patient.id,
        patientId: patient.id,
      });
    });
    revalidateClinic(patient.id);
    return { ok: true };
  });
}

export async function reactivatePatient(input: { patientId: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const patient = await assertCanAccessPatient(clinician, uuid.parse(input.patientId));
    await db.update(users).set({ dischargedAt: null }).where(eq(users.id, patient.id));
    revalidateClinic(patient.id);
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Programs                                                            */
/* ------------------------------------------------------------------ */

const saveProgramSchema = z.object({
  patientId: uuid,
  programId: uuid.nullable(),
  draft: draftSchema,
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

/**
 * Assigns a new program or saves an edited one as a new version.
 * Sessions already in progress keep the version they started with.
 */
export async function saveProgram(input: z.infer<typeof saveProgramSchema>) {
  return run(async () => {
    const clinician = await requireClinician();
    const data = saveProgramSchema.parse(input);
    const patient = await assertCanAccessPatient(clinician, data.patientId);
    if (patient.dischargedAt) throw new UserFacingError(`${firstName(patient.name)} has been discharged. Reactivate them first.`);
    const [patientRow] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, patient.id));
    const today = todayIn(patientRow.timezone);
    const startDate = data.startDate && data.startDate > today ? data.startDate : today;

    const result = await db.transaction(async (tx) => {
      const written = await writeProgramVersion(tx, {
        orgId: clinician.orgId,
        patientId: patient.id,
        clinicianId: clinician.id,
        programId: data.programId,
        draft: data.draft,
        effectiveFrom: data.programId ? today : startDate,
        startDate,
      });
      if (!written.changed) return written;

      const isNew = !data.programId;
      await audit(tx, {
        orgId: clinician.orgId,
        actorId: clinician.id,
        action: isNew ? "program.assigned" : "program.edited",
        entityType: "program",
        entityId: written.programId,
        patientId: patient.id,
        data: { version: written.version, changes: written.changeSummary },
      });
      await notify(tx, {
        userId: patient.id,
        kind: isNew ? "plan_assigned" : "plan_updated",
        body: isNew
          ? `${firstName(clinician.name)} set up your plan: ${data.draft.title}`
          : `${firstName(clinician.name)} updated your plan`,
        href: "/app/program",
      });
      // Changing the prescription answers the signals about the exercises that changed.
      if (!isNew && written.touchedExerciseIds?.length) {
        await resolveAttention(tx, { patientId: patient.id, exerciseIds: written.touchedExerciseIds }, clinician.id);
      }
      if (!isNew) await resolveAttention(tx, { patientId: patient.id, kinds: ["missed_repeat"] }, clinician.id);
      await track(tx, clinician.id, isNew ? "clinician_program_created" : "program_edited", {
        exercises: data.draft.items.length,
      });
      if (isNew) await track(tx, clinician.id, "program_assigned", { patientId: patient.id });
      if (written.addedCount) await track(tx, clinician.id, "exercise_added", { count: written.addedCount });
      return written;
    });

    // Remember schedule preference for smart defaults next time.
    await db
      .update(users)
      .set({ preferences: { defaultDays: data.draft.days } })
      .where(eq(users.id, clinician.id));

    revalidateClinic(patient.id);
    return { programId: result.programId, changed: result.changed, changeSummary: result.changeSummary };
  });
}

export async function endProgram(input: { patientId: string; programId: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const patient = await assertCanAccessPatient(clinician, uuid.parse(input.patientId));
    const [patientRow] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, patient.id));
    const updated = await db
      .update(programs)
      .set({ status: "completed", endDate: todayIn(patientRow.timezone), updatedAt: new Date() })
      .where(and(eq(programs.id, uuid.parse(input.programId)), eq(programs.patientId, patient.id)))
      .returning({ id: programs.id });
    if (!updated.length) throw new UserFacingError("Program not found.");
    await audit(db, {
      orgId: clinician.orgId,
      actorId: clinician.id,
      action: "program.ended",
      entityType: "program",
      entityId: updated[0].id,
      patientId: patient.id,
    });
    revalidateClinic(patient.id);
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Communication & review                                              */
/* ------------------------------------------------------------------ */

const clinicianMessageSchema = z.object({
  patientId: uuid,
  body: z.string().trim().min(1, "Write a message first.").max(2000),
  clientId: z.string().min(8).max(64),
  exerciseId: uuid.nullable().optional(),
  feedbackId: uuid.nullable().optional(),
});

export async function sendClinicianMessage(input: z.infer<typeof clinicianMessageSchema>) {
  return run(async () => {
    const clinician = await requireClinician();
    const data = clinicianMessageSchema.parse(input);
    const patient = await assertCanAccessPatient(clinician, data.patientId);
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(messages)
        .values({
          patientId: patient.id,
          senderId: clinician.id,
          body: data.body,
          exerciseId: data.exerciseId ?? null,
          feedbackId: data.feedbackId ?? null,
          clientId: data.clientId,
        })
        .onConflictDoNothing()
        .returning({ id: messages.id });
      if (!inserted.length) return;
      // Replying is reviewing: mark the patient's messages read and the feedback seen.
      await tx
        .update(messages)
        .set({ readAt: new Date() })
        .where(and(eq(messages.patientId, patient.id), eq(messages.senderId, patient.id), isNull(messages.readAt)));
      if (data.feedbackId) {
        await tx
          .update(feedback)
          .set({ reviewedAt: new Date() })
          .where(and(eq(feedback.id, data.feedbackId), eq(feedback.patientId, patient.id)));
        await tx
          .update(attentionItems)
          .set({ resolvedAt: new Date(), resolvedById: clinician.id })
          .where(
            and(
              eq(attentionItems.patientId, patient.id),
              isNull(attentionItems.resolvedAt),
              eq(attentionItems.dedupeKey, `pain:${data.feedbackId}`),
            ),
          );
        await tx
          .update(attentionItems)
          .set({ resolvedAt: new Date(), resolvedById: clinician.id })
          .where(
            and(
              eq(attentionItems.patientId, patient.id),
              isNull(attentionItems.resolvedAt),
              eq(attentionItems.dedupeKey, `note:${data.feedbackId}`),
            ),
          );
      }
      await notify(tx, {
        userId: patient.id,
        kind: "message",
        body: `${firstName(clinician.name)} sent you a message`,
        href: "/app/messages",
      });
    });
    revalidateClinic(patient.id);
    return { ok: true };
  });
}

export async function markPatientThreadRead(input: { patientId: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const patient = await assertCanAccessPatient(clinician, uuid.parse(input.patientId));
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.patientId, patient.id), eq(messages.senderId, patient.id), isNull(messages.readAt)));
    await track(db, clinician.id, "clinician_feedback_viewed", { patientId: patient.id });
    revalidateClinic();
    return { ok: true };
  });
}

export async function resolveAttentionItem(input: { patientId: string; itemId: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const patient = await assertCanAccessPatient(clinician, uuid.parse(input.patientId));
    await resolveAttention(db, { patientId: patient.id, ids: [uuid.parse(input.itemId)] }, clinician.id);
    revalidateClinic();
    return { ok: true };
  });
}

export async function resolveAllAttention(input: { patientId: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const patient = await assertCanAccessPatient(clinician, uuid.parse(input.patientId));
    await resolveAttention(db, { patientId: patient.id }, clinician.id);
    await db
      .update(feedback)
      .set({ reviewedAt: new Date() })
      .where(and(eq(feedback.patientId, patient.id), isNull(feedback.reviewedAt)));
    await track(db, clinician.id, "clinician_feedback_viewed", { patientId: patient.id });
    revalidateClinic();
    return { ok: true };
  });
}

export async function addClinicianNote(input: { patientId: string; body: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const patient = await assertCanAccessPatient(clinician, uuid.parse(input.patientId));
    const body = z.string().trim().min(1, "Write a note first.").max(4000).parse(input.body);
    await db.insert(clinicianNotes).values({ patientId: patient.id, authorId: clinician.id, body });
    await audit(db, {
      orgId: clinician.orgId,
      actorId: clinician.id,
      action: "clinician.note_added",
      entityType: "patient",
      entityId: patient.id,
      patientId: patient.id,
    });
    revalidateClinic();
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

const templateSchema = z.object({
  templateId: uuid.nullable(),
  name: z.string().trim().min(1, "Name the template.").max(80),
  description: z.string().trim().max(300).nullable(),
  draft: draftSchema.omit({ title: true }),
});

export async function saveTemplate(input: z.infer<typeof templateSchema>) {
  return run(async () => {
    const clinician = await requireClinician();
    const data = templateSchema.parse(input);
    const templateId = await db.transaction(async (tx) => {
      let id = data.templateId;
      if (id) {
        const updated = await tx
          .update(templates)
          .set({ name: data.name, description: data.description, days: data.draft.days, updatedAt: new Date() })
          .where(and(eq(templates.id, id), eq(templates.orgId, clinician.orgId)))
          .returning({ id: templates.id });
        if (!updated.length) throw new UserFacingError("Template not found.");
        await tx.delete(templateExercises).where(eq(templateExercises.templateId, id));
      } else {
        const [created] = await tx
          .insert(templates)
          .values({
            orgId: clinician.orgId,
            name: data.name,
            description: data.description,
            days: data.draft.days,
            createdById: clinician.id,
          })
          .returning({ id: templates.id });
        id = created.id;
      }
      await tx.insert(templateExercises).values(
        data.draft.items.map((item, position) => ({
          templateId: id!,
          exerciseId: item.exerciseId,
          position,
          sets: item.sets,
          reps: item.durationSec ? null : item.reps,
          durationSec: item.durationSec,
          perSide: item.perSide,
          side: item.side,
          days: item.days,
          note: item.note,
        })),
      );
      await audit(tx, {
        orgId: clinician.orgId,
        actorId: clinician.id,
        action: "template.saved",
        entityType: "template",
        entityId: id,
      });
      return id!;
    });
    revalidatePath("/clinic/templates");
    return { templateId };
  });
}

export async function duplicateTemplate(input: { templateId: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const id = uuid.parse(input.templateId);
    const [source] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.orgId, clinician.orgId)));
    if (!source) throw new UserFacingError("Template not found.");
    const items = await db.select().from(templateExercises).where(eq(templateExercises.templateId, id));
    const newId = await db.transaction(async (tx) => {
      const [copy] = await tx
        .insert(templates)
        .values({
          orgId: clinician.orgId,
          name: `${source.name} (copy)`,
          description: source.description,
          days: source.days,
          createdById: clinician.id,
        })
        .returning({ id: templates.id });
      if (items.length) {
        await tx.insert(templateExercises).values(
          items.map(({ id: _id, templateId: _t, ...rest }) => ({ ...rest, templateId: copy.id })),
        );
      }
      return copy.id;
    });
    revalidatePath("/clinic/templates");
    return { templateId: newId };
  });
}

export async function deleteTemplate(input: { templateId: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const id = uuid.parse(input.templateId);
    const deleted = await db
      .delete(templates)
      .where(and(eq(templates.id, id), eq(templates.orgId, clinician.orgId)))
      .returning({ id: templates.id });
    if (!deleted.length) throw new UserFacingError("Template not found.");
    await audit(db, {
      orgId: clinician.orgId,
      actorId: clinician.id,
      action: "template.deleted",
      entityType: "template",
      entityId: id,
    });
    revalidatePath("/clinic/templates");
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Team (clinic admin)                                                 */
/* ------------------------------------------------------------------ */

const addClinicianSchema = z.object({
  name: z.string().trim().min(1, "Add their name.").max(80),
  email: z.string().trim().toLowerCase().email("That email doesn't look right."),
  credentials: z.string().trim().max(20).optional(),
});

export async function addClinician(input: z.infer<typeof addClinicianSchema>) {
  return run(async () => {
    const admin = await requireAdmin();
    const data = addClinicianSchema.parse(input);
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
    if (taken) throw new UserFacingError("Someone with that email already has a FORM account.");
    const [clinician] = await db
      .insert(users)
      .values({
        orgId: admin.orgId,
        email: data.email,
        name: data.name,
        role: "clinician",
        credentials: data.credentials || "PT",
        timezone: admin.timezone,
        onboardedAt: new Date(),
      })
      .returning({ id: users.id });
    const inviteUrl = await createInvite(admin.orgId, clinician.id, admin.id);
    await audit(db, {
      orgId: admin.orgId,
      actorId: admin.id,
      action: "permission.changed",
      entityType: "user",
      entityId: clinician.id,
      data: { role: "clinician" },
    });
    revalidatePath("/clinic/settings");
    return { inviteUrl };
  });
}

/** Share a patient with another clinician in the clinic (or take over care). */
export async function assignClinician(input: { patientId: string; clinicianId: string }) {
  return run(async () => {
    const clinician = await requireClinician();
    const patient = await assertCanAccessPatient(clinician, uuid.parse(input.patientId));
    const [target] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, uuid.parse(input.clinicianId)), eq(users.orgId, clinician.orgId), ne(users.role, "patient")));
    if (!target) throw new UserFacingError("Clinician not found.");
    await db
      .insert(careRelationships)
      .values({ patientId: patient.id, clinicianId: target.id, isPrimary: false })
      .onConflictDoUpdate({
        target: [careRelationships.patientId, careRelationships.clinicianId],
        set: { endedAt: null },
      });
    await audit(db, {
      orgId: clinician.orgId,
      actorId: clinician.id,
      action: "permission.changed",
      entityType: "care_relationship",
      entityId: patient.id,
      patientId: patient.id,
      data: { added: target.id },
    });
    revalidateClinic();
    return { ok: true };
  });
}

/* ------------------------------------------------------------------ */
/* Exercise video (clinic's own choice)                                */
/* ------------------------------------------------------------------ */

const videoSchema = z.object({
  exerciseId: uuid,
  /** A YouTube URL or id. null removes the clinic's video (falls back to FORM's default). */
  url: z.string().trim().max(300).nullable(),
});

export async function setExerciseVideo(input: z.infer<typeof videoSchema>) {
  return run(async () => {
    const clinician = await requireClinician();
    const data = videoSchema.parse(input);
    const [exercise] = await db
      .select({ id: exercises.id, name: exercises.name, orgId: exercises.orgId })
      .from(exercises)
      .where(eq(exercises.id, data.exerciseId))
      .limit(1);
    if (!exercise || (exercise.orgId && exercise.orgId !== clinician.orgId)) throw new UserFacingError("Exercise not found.");

    await db
      .delete(exerciseMedia)
      .where(and(eq(exerciseMedia.exerciseId, exercise.id), eq(exerciseMedia.orgId, clinician.orgId), eq(exerciseMedia.type, "video")));

    if (data.url) {
      const id = parseYouTubeId(data.url);
      if (!id) throw new UserFacingError("That doesn't look like a YouTube link. Paste the video's address from YouTube.");
      await db.insert(exerciseMedia).values({
        exerciseId: exercise.id,
        orgId: clinician.orgId,
        type: "video",
        provider: "youtube",
        externalId: id,
        title: exercise.name,
        source: clinician.orgName,
        altText: `Video demonstration of ${exercise.name}`,
        position: 0,
      });
    }
    await audit(db, {
      orgId: clinician.orgId,
      actorId: clinician.id,
      action: "exercise.video_changed",
      entityType: "exercise",
      entityId: exercise.id,
      data: { removed: !data.url },
    });
    revalidatePath("/clinic", "layout");
    revalidatePath("/app", "layout");
    return { ok: true };
  });
}
