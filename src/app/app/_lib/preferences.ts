import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * The signed-in patient's notification preferences (not part of CurrentUser).
 * Read-only; scoped to the id from the verified session.
 * Candidate to move into src/server/services/patient.ts as getPatientPreferences().
 */
export async function getPatientPreferences(userId: string) {
  const [row] = await db
    .select({
      notifyReminders: users.notifyReminders,
      notifyMessages: users.notifyMessages,
      reminderTime: users.reminderTime,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    notifyReminders: row?.notifyReminders ?? true,
    notifyMessages: row?.notifyMessages ?? true,
    reminderTime: row?.reminderTime ?? "08:00",
  };
}
