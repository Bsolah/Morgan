import type { Database } from "@morgan/db";
import { createDb } from "@morgan/db";
import pg from "pg";
import { env } from "../config.js";

let db: Database | null = null;
let pool: pg.Pool | null = null;

export function getDb(): Database | null {
  if (!env.DATABASE_URL) return null;
  if (!db) {
    pool = new pg.Pool({ connectionString: env.DATABASE_URL });
    db = createDb(env.DATABASE_URL);
  }
  return db;
}

export async function checkPostgres(): Promise<boolean> {
  if (!env.DATABASE_URL) return false;
  const client = new pg.Pool({ connectionString: env.DATABASE_URL });
  try {
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end();
  }
}

export async function checkRedis(): Promise<boolean> {
  if (!env.REDIS_URL) return true; // optional in dev
  // Skeleton: Redis client added when ingest worker needs dedup
  return true;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
