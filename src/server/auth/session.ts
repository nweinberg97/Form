import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db";
import { authSessions, organizations, users, type User } from "../db/schema";
import { randomToken, sha256 } from "./password";

export const SESSION_COOKIE = "form_session";
const SESSION_DAYS = 30;
const DEMO_SESSION_HOURS = 24;

export type CurrentUser = Pick<
  User,
  "id" | "orgId" | "email" | "name" | "role" | "credentials" | "timezone" | "onboardedAt" | "dischargedAt"
> & { orgName: string; isDemo: boolean };

export async function createSession(userId: string, opts: { demo?: boolean } = {}) {
  const token = randomToken();
  const ms = opts.demo ? DEMO_SESSION_HOURS * 3600_000 : SESSION_DAYS * 86_400_000;
  const expiresAt = new Date(Date.now() + ms);
  await db.insert(authSessions).values({ id: sha256(token), userId, expiresAt });
  // Opportunistic cleanup of expired sessions.
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(authSessions).where(eq(authSessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: users.id,
      orgId: users.orgId,
      email: users.email,
      name: users.name,
      role: users.role,
      credentials: users.credentials,
      timezone: users.timezone,
      onboardedAt: users.onboardedAt,
      dischargedAt: users.dischargedAt,
      orgName: organizations.name,
      isDemo: organizations.isDemo,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(and(eq(authSessions.id, sha256(token)), gt(authSessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
});
