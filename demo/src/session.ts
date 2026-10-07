import { eq } from "drizzle-orm";
import { db } from "./db";
import { organizations, users, type User } from "../../src/server/db/schema";

/** Browser demo session: the signed-in demo user lives in localStorage. */
export const SESSION_COOKIE = "form:session";

export type CurrentUser = Pick<
  User,
  "id" | "orgId" | "email" | "name" | "role" | "credentials" | "timezone" | "onboardedAt" | "dischargedAt"
> & { orgName: string; isDemo: boolean };

export async function createSession(userId: string, _opts: { demo?: boolean } = {}) {
  localStorage.setItem(SESSION_COOKIE, userId);
}

export async function destroySession() {
  localStorage.removeItem(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const id = localStorage.getItem(SESSION_COOKIE);
  if (!id) return null;
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
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}
