"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { invitations, organizations, users } from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroySession, getCurrentUser } from "../auth/session";
import { run, UserFacingError, type ActionResult } from "./result";
import { isValidTimeZone } from "@/lib/dates";
import { demoEmail, seedDemoClinic } from "../seed/demo";
import { lookupInvite } from "../services/invites";

const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200)
  .refine((v) => !/^(.)\1+$/.test(v), "Choose a less predictable password.");
const email = z.string().trim().toLowerCase().email("That email doesn't look right.").max(200);
const timezone = z
  .string()
  .optional()
  .transform((tz) => (tz && isValidTimeZone(tz) ? tz : "America/Vancouver"));

/* ---------- Basic brute-force protection (per process) ---------- */

const attempts = new Map<string, { count: number; until: number }>();

async function throttle(key: string) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const id = `${ip}:${key}`;
  const now = Date.now();
  const entry = attempts.get(id);
  if (entry && entry.until > now && entry.count >= 8) {
    throw new UserFacingError("Too many attempts. Wait a few minutes and try again.");
  }
  return {
    fail() {
      const current = attempts.get(id);
      const fresh = !current || current.until < now;
      attempts.set(id, { count: fresh ? 1 : current.count + 1, until: now + 10 * 60_000 });
    },
    clear() {
      attempts.delete(id);
    },
  };
}

function homeFor(role: "patient" | "clinician" | "admin", onboarded: boolean) {
  if (role === "patient") return onboarded ? "/app" : "/app/onboarding";
  return "/clinic";
}

/* ---------- Sign in / out ---------- */

const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });

export async function signIn(_prev: ActionResult<{ to: string }> | null, form: FormData) {
  const result = await run(async () => {
    const data = signInSchema.parse({ email: form.get("email"), password: form.get("password") });
    const limiter = await throttle(data.email);
    const [user] = await db
      .select({
        id: users.id,
        role: users.role,
        passwordHash: users.passwordHash,
        onboardedAt: users.onboardedAt,
        isDemo: organizations.isDemo,
      })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(sql`lower(${users.email}) = ${data.email}`)
      .limit(1);
    const valid = await verifyPassword(data.password, user && !user.isDemo ? user.passwordHash : null);
    if (!user || !valid) {
      limiter.fail();
      throw new UserFacingError("That email and password don't match.");
    }
    limiter.clear();
    await createSession(user.id);
    return { to: homeFor(user.role, Boolean(user.onboardedAt)) };
  });
  if (result.ok) redirect(result.data.to);
  return result;
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

/* ---------- Clinic sign-up (creates an organization) ---------- */

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(80),
  clinic: z.string().trim().min(1, "Add your clinic's name.").max(100),
  email,
  password,
  credentials: z.string().trim().max(20).optional(),
  timezone,
});

export async function signUpClinic(_prev: ActionResult<{ to: string }> | null, form: FormData) {
  const result = await run(async () => {
    const data = signUpSchema.parse(Object.fromEntries(form));
    await throttle(`signup:${data.email}`);
    const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${data.email}`);
    if (taken) throw new UserFacingError("An account with that email already exists. Try signing in.");
    const passwordHash = await hashPassword(data.password);
    const userId = await db.transaction(async (tx) => {
      const [org] = await tx.insert(organizations).values({ name: data.clinic }).returning({ id: organizations.id });
      const [user] = await tx
        .insert(users)
        .values({
          orgId: org.id,
          email: data.email,
          passwordHash,
          name: data.name,
          role: "admin",
          credentials: data.credentials || "PT",
          timezone: data.timezone,
          onboardedAt: new Date(),
        })
        .returning({ id: users.id });
      return user.id;
    });
    await createSession(userId);
    return { to: "/clinic?welcome=1" };
  });
  if (result.ok) redirect(result.data.to);
  return result;
}

/* ---------- Invitations ---------- */

const acceptSchema = z.object({ code: z.string().min(10).max(100), email, password, timezone });

export async function acceptInvite(_prev: ActionResult<{ to: string }> | null, form: FormData) {
  const result = await run(async () => {
    const data = acceptSchema.parse(Object.fromEntries(form));
    await throttle(`invite:${data.code.slice(0, 8)}`);
    const invite = await lookupInvite(data.code);
    if (!invite) throw new UserFacingError("This invitation has expired or was already used. Ask your clinic for a new link.");
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${data.email} and ${users.id} <> ${invite.userId}`);
    if (taken) throw new UserFacingError("That email is already used by another FORM account.");
    const passwordHash = await hashPassword(data.password);
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          email: data.email,
          passwordHash,
          timezone: data.timezone,
          onboardedAt: invite.role === "patient" ? null : new Date(),
        })
        .where(eq(users.id, invite.userId));
      await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invite.id));
    });
    await createSession(invite.userId);
    return { to: invite.role === "patient" ? "/app/onboarding" : "/clinic" };
  });
  if (result.ok) redirect(result.data.to);
  return result;
}

/* ---------- Demo ---------- */

/**
 * Creates a private, freshly seeded demo clinic for this visitor and signs
 * them in as either the clinician (Marina Chen, PT) or the patient (Jordan Lee).
 */
export async function startDemo(form: FormData) {
  if (process.env.FORM_DEMO_ENABLED === "false") redirect("/login");
  const as = form.get("as") === "patient" ? "patient" : "clinician";
  const tz = String(form.get("timezone") ?? "");
  const current = await getCurrentUser();
  let target: string;
  if (current?.isDemo) {
    target = await demoUserFor(current.orgId, as);
  } else {
    // Clear out expired demo clinics opportunistically.
    await db.delete(organizations).where(and(eq(organizations.isDemo, true), lt(organizations.expiresAt, new Date())));
    const seeded = await seedDemoClinic(db, { timezone: isValidTimeZone(tz) ? tz : "America/Vancouver" });
    target = as === "patient" ? seeded.patientId : seeded.clinicianId;
  }
  await createSession(target, { demo: true });
  redirect(as === "patient" ? "/app" : "/clinic");
}

async function demoUserFor(orgId: string, as: "patient" | "clinician") {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.orgId, orgId),
        as === "patient" ? eq(users.email, demoEmail(orgId, "jordan")) : eq(users.email, demoEmail(orgId, "marina")),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Demo user missing");
  return row.id;
}

/** Inside a demo: flip between Marina's clinician view and Jordan's patient view. */
export async function switchDemoView(form: FormData) {
  const current = await getCurrentUser();
  if (!current?.isDemo) redirect("/login");
  const as = form.get("as") === "patient" ? "patient" : "clinician";
  const target = await demoUserFor(current.orgId, as);
  await destroySession();
  await createSession(target, { demo: true });
  redirect(as === "patient" ? "/app" : "/clinic");
}
