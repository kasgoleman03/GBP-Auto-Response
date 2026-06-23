/**
 * Drizzle client for Vercel Postgres (Neon).
 *
 * Lazily initialized so importing this module never throws when POSTGRES_URL is
 * absent (e.g. during build / page-data collection). Callers get a clear error
 * only when they actually hit the database.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cached: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (cached) return cached;
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("POSTGRES_URL is not set");
  }
  cached = drizzle(neon(url), { schema });
  return cached;
}
