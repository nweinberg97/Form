import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./index";
import { syncExerciseLibrary } from "../seed/library";

let ready: Promise<void> | null = null;

/**
 * Applies pending migrations and syncs the approved exercise library.
 * Idempotent; runs once per server process (see src/instrumentation.ts).
 */
export function bootstrap() {
  ready ??= (async () => {
    const db = getDb();
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    await syncExerciseLibrary(db);
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}
