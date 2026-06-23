import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for Vercel Postgres (Neon).
 *
 * Reads POSTGRES_URL (Vercel's default when you attach a Postgres store).
 * For local pushes, copy the connection string from the Vercel dashboard or
 * run `vercel env pull` and use POSTGRES_URL from `.env.local`.
 */
export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
