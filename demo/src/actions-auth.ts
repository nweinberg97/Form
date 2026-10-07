import { and, eq } from "drizzle-orm";
import { db, resetDemoDatabase } from "./db";
import { createSession, destroySession, getCurrentUser } from "./session";
import { navigate } from "./router";
import { invitations, organizations, users } from "../../src/server/db/schema";
import { demoEmail, seedDemoClinic } from "../../src/server/seed/demo";
import { lookupInvite } from "../../src/server/services/invites";
import { isValidTimeZone } from "../../src/lib/dates";
import type { ActionResult } from "../../src/server/actions/result";

/**
 * Browser-demo versions of the sign-in actions. Accounts with passwords are
 * part of the full (server) version; here, "Try the demo" seeds a private
 * sample clinic in this browser and signs you in as Marina or Jordan.
 */

const STATE_KEY = "form:demo";
const RESEED_AFTER_DAYS = 3;

type DemoState = { orgId: string; seededAt: number };

function readState(): DemoState | null {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) ?? "null");
  } catch {
    return null;
  }
}

async function ensureDemoClinic(timezone: string) {
  const state = readState();
  if (state && Date.now() - state.seededAt < RESEED_AFTER_DAYS * 86_400_000) {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, state.orgId));
    if (org) return state.orgId;
  }
  if (state) await db.delete(organizations).where(eq(organizations.id, state.orgId));
  const seeded = await seedDemoClinic(db, { timezone: isValidTimeZone(timezone) ? timezone : "America/Vancouver" });
  localStorage.setItem(STATE_KEY, JSON.stringify({ orgId: seeded.orgId, seededAt: Date.now() } satisfies DemoState));
  return seeded.orgId;
}

async function demoUser(orgId: string, as: "patient" | "clinician") {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.email, demoEmail(orgId, as === "patient" ? "jordan" : "marina"))))
    .limit(1);
  return row?.id ?? null;
}

export async function startDemo(form: FormData) {
  const as = form.get("as") === "patient" ? "patient" : "clinician";
  const tz = String(form.get("timezone") ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const orgId = await ensureDemoClinic(tz);
  const userId = await demoUser(orgId, as);
  if (!userId) {
    // The sample clinic was changed beyond recognition — start fresh.
    localStorage.removeItem(STATE_KEY);
    return startDemo(form);
  }
  await createSession(userId);
  navigate(as === "patient" ? "/app" : "/clinic");
}

export async function switchDemoView(form: FormData) {
  const current = await getCurrentUser();
  const as = form.get("as") === "patient" ? "patient" : "clinician";
  const orgId = current?.orgId ?? readState()?.orgId;
  if (!orgId) return navigate("/demo");
  const userId = await demoUser(orgId, as);
  if (!userId) return navigate("/demo");
  await createSession(userId);
  navigate(as === "patient" ? "/app" : "/clinic");
}

export async function signOut() {
  await destroySession();
  navigate("/");
}

const accountsNote = "Accounts are part of the full version. This browser demo uses a sample clinic — choose “Try the demo”.";

export async function signIn(_prev: ActionResult<{ to: string }> | null, _form: FormData): Promise<ActionResult<{ to: string }>> {
  return { ok: false, error: accountsNote };
}

export async function signUpClinic(_prev: ActionResult<{ to: string }> | null, _form: FormData): Promise<ActionResult<{ to: string }>> {
  return { ok: false, error: accountsNote };
}

/** Invites work in the demo: a clinician's invite link signs you in as that patient. */
export async function acceptInvite(_prev: ActionResult<{ to: string }> | null, form: FormData): Promise<ActionResult<{ to: string }>> {
  const code = String(form.get("code") ?? "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const invite = await lookupInvite(code);
  if (!invite) return { ok: false, error: "This invitation has expired or was already used." };
  const tz = String(form.get("timezone") ?? "");
  await db
    .update(users)
    .set({
      ...(email ? { email } : {}),
      passwordHash: "demo",
      timezone: isValidTimeZone(tz) ? tz : "America/Vancouver",
      onboardedAt: invite.role === "patient" ? null : new Date(),
    })
    .where(eq(users.id, invite.userId));
  await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invite.id));
  await createSession(invite.userId);
  const to = invite.role === "patient" ? "/app/onboarding" : "/clinic";
  navigate(to);
  return { ok: true, data: { to } };
}

export async function resetDemo() {
  await resetDemoDatabase();
  location.hash = "#/demo";
  location.reload();
}
