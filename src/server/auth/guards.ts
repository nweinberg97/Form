import "server-only";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { careRelationships, users } from "../db/schema";
import { getCurrentUser, type CurrentUser } from "./session";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404 = 403,
  ) {
    super(message);
  }
}

export type Clinician = CurrentUser & { role: "clinician" | "admin" };
export type Patient = CurrentUser & { role: "patient" };

/* ---------- Page guards: redirect ---------- */

export async function requireUserPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePatientPage(): Promise<Patient> {
  const user = await requireUserPage();
  if (user.role !== "patient") redirect("/clinic");
  return user as Patient;
}

export async function requireClinicianPage(): Promise<Clinician> {
  const user = await requireUserPage();
  if (user.role === "patient") redirect("/app");
  return user as Clinician;
}

/* ---------- Action guards: throw ---------- */

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Not signed in", 401);
  return user;
}

export async function requirePatient(): Promise<Patient> {
  const user = await requireUser();
  if (user.role !== "patient") throw new AuthError("Patients only");
  if (user.dischargedAt) throw new AuthError("This plan has ended");
  return user as Patient;
}

export async function requireClinician(): Promise<Clinician> {
  const user = await requireUser();
  if (user.role !== "clinician" && user.role !== "admin") throw new AuthError("Clinicians only");
  return user as Clinician;
}

export async function requireAdmin(): Promise<Clinician> {
  const user = await requireClinician();
  if (user.role !== "admin") throw new AuthError("Clinic admins only");
  return user;
}

/**
 * Verifies the clinician may act on this patient:
 * same organization AND (an active care relationship OR clinic admin).
 * The patientId is a lookup key only — access is derived from the session.
 */
export async function assertCanAccessPatient(clinician: Clinician, patientId: string) {
  const [patient] = await db
    .select({ id: users.id, orgId: users.orgId, role: users.role, name: users.name, dischargedAt: users.dischargedAt })
    .from(users)
    .where(eq(users.id, patientId))
    .limit(1);
  if (!patient || patient.role !== "patient" || patient.orgId !== clinician.orgId) {
    throw new AuthError("Patient not found", 404);
  }
  if (clinician.role === "admin") return patient;
  const [relationship] = await db
    .select({ patientId: careRelationships.patientId })
    .from(careRelationships)
    .where(
      and(
        eq(careRelationships.patientId, patientId),
        eq(careRelationships.clinicianId, clinician.id),
        isNull(careRelationships.endedAt),
      ),
    )
    .limit(1);
  if (!relationship) throw new AuthError("You don't have access to this patient");
  return patient;
}

/** For pages: same check, but 404s instead of throwing. */
export async function canAccessPatient(clinician: Clinician, patientId: string) {
  try {
    return await assertCanAccessPatient(clinician, patientId);
  } catch {
    return null;
  }
}
