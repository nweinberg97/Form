import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
/** Anything that can run queries: the db itself or a transaction. */
export type Queryable = Database | Tx;

const globalForDb = globalThis as unknown as { formPool?: Pool; formDb?: Database };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and point it at a Postgres database.");
  }
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
}

export function getDb(): Database {
  if (!globalForDb.formDb) {
    globalForDb.formPool ??= createPool();
    globalForDb.formDb = drizzle(globalForDb.formPool, { schema });
  }
  return globalForDb.formDb;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
