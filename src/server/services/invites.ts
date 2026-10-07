import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { invitations, organizations, users } from "../db/schema";
import { sha256 } from "../auth/password";

export async function lookupInvite(code: string) {
  if (!code || code.length > 100) return null;
  const [row] = await db
    .select({
      id: invitations.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      orgName: organizations.name,
      invitedBy: sql<string | null>`(select u.name from users u where u.id = ${invitations.invitedById})`,
    })
    .from(invitations)
    .innerJoin(users, eq(users.id, invitations.userId))
    .innerJoin(organizations, eq(organizations.id, invitations.orgId))
    .where(and(eq(invitations.tokenHash, sha256(code)), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  return { ...row, email: row.email.endsWith("@invite.form.local") ? "" : row.email };
}
