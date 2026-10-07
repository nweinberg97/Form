import type { Queryable } from "../db";
import { analyticsEvents, auditEvents, notifications } from "../db/schema";

export type AnalyticsEvent =
  | "patient_session_started"
  | "exercise_viewed"
  | "exercise_completed"
  | "exercise_feedback_submitted"
  | "session_completed"
  | "session_missed"
  | "clinician_program_created"
  | "exercise_added"
  | "program_assigned"
  | "program_edited"
  | "clinician_feedback_viewed";

/** Product analytics — best effort, never blocks the user. */
export async function track(db: Queryable, userId: string | null, name: AnalyticsEvent, props?: Record<string, unknown>) {
  try {
    await db.insert(analyticsEvents).values({ userId, name, props });
  } catch (error) {
    console.error("[analytics]", error);
  }
}

export type AuditAction =
  | "program.created"
  | "program.assigned"
  | "program.edited"
  | "program.ended"
  | "exercise.added"
  | "exercise.removed"
  | "dosage.changed"
  | "note.changed"
  | "patient.created"
  | "patient.discharged"
  | "patient.invited"
  | "clinician.note_added"
  | "template.saved"
  | "template.deleted"
  | "exercise.video_changed"
  | "permission.changed";

export async function audit(
  db: Queryable,
  entry: {
    orgId: string;
    actorId: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    patientId?: string | null;
    data?: Record<string, unknown>;
  },
) {
  await db.insert(auditEvents).values({
    orgId: entry.orgId,
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    patientId: entry.patientId ?? null,
    data: entry.data,
  });
}

export async function notify(
  db: Queryable,
  entry: { userId: string; kind: "plan_updated" | "message" | "plan_assigned"; body: string; href?: string },
) {
  await db.insert(notifications).values(entry);
}
