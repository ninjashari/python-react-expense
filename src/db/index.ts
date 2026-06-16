import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { Pool } from "pg";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const isNeon = /\.neon\.tech$/i.test(new URL(connectionString).hostname);

// Neon's HTTP driver only reaches real Neon/Vercel/Supabase endpoints; any other
// host (e.g. local Postgres) falls back to a standard TCP connection via `pg`.
// Both drivers implement the same query-builder API, so we type the export as
// one canonical interface to avoid TS collapsing overloads across the union.
export const db = (
  isNeon
    ? drizzleNeon(neon(connectionString), { schema })
    : drizzlePg(new Pool({ connectionString }), { schema })
) as NodePgDatabase<typeof schema>;

export { schema };
