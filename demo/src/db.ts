import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as schema from "../../src/server/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * The browser demo's database: real Postgres (PGlite, compiled to WebAssembly),
 * persisted in this browser's IndexedDB. Same schema and migrations as production.
 */
export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Queryable = Database | Tx;

const DATA_DIR = "idb://form-demo";
export const client = new PGlite(DATA_DIR, { relaxedDurability: true });
export const db = drizzle({ client, schema }) as unknown as Database;
export const getDb = () => db;
export { schema };

const migrations = import.meta.glob("../../drizzle/*.sql", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

export async function migrateDemoDatabase() {
  await client.waitReady;
  await client.exec(`create table if not exists __form_demo_migrations (name text primary key, applied_at timestamptz default now())`);
  const applied = new Set(
    (await client.query<{ name: string }>(`select name from __form_demo_migrations`)).rows.map((r) => r.name),
  );
  for (const file of Object.keys(migrations).sort()) {
    const name = file.split("/").pop()!;
    if (applied.has(name)) continue;
    for (const statement of migrations[file].split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
    await client.query(`insert into __form_demo_migrations (name) values ($1)`, [name]);
  }
}

export async function countRows(table: "exercises" | "organizations") {
  const result = await db.execute<{ n: number }>(sql.raw(`select count(*)::int as n from ${table}`));
  return Number(result.rows[0]?.n ?? 0);
}

/** Wipes this browser's demo data. */
export async function resetDemoDatabase() {
  localStorage.removeItem("form:demo");
  localStorage.removeItem("form:session");
  try {
    await client.close();
  } catch {
    /* already closed */
  }
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("/pglite/form-demo");
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}
