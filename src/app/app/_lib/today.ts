import "server-only";
import { cache } from "react";
import { getToday } from "@/server/services/patient";
import type { CurrentUser } from "@/server/auth/session";

/**
 * getToday, de-duplicated per request: the shell (unread count) and the Today
 * page share one computation. The user object from requirePatientPage() is
 * itself request-cached, so identity-based memoization holds.
 */
export const getTodayCached = cache((user: CurrentUser) => getToday(user));
