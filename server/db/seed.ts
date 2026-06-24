/**
 * Database seeding.
 *
 * Populates the DB with the mock provider's sample reviews run through the real
 * pipeline (so reviews, drafts, and activity rows appear exactly as they would
 * in production) plus the default rules/voice config. Callable on first run or
 * via the admin reset-ledger route for a fresh testing dataset.
 */
import { MockProvider } from "../../providers/mock";
import { runPipeline } from "../pipeline";
import { ensureDefaults } from "./repo";

export interface SeedResult {
  ok: boolean;
  processed: number;
  failed: number;
  errors: string[];
}

/**
 * Seed sample reviews through the pipeline. Requires POSTGRES_URL (so rows
 * persist) and ANTHROPIC_API_KEY (so drafts generate). Each review is processed
 * independently; a failure on one does not abort the rest.
 */
export async function seedDatabase(): Promise<SeedResult> {
  console.log("[seed] starting database seed");
  await ensureDefaults();

  const provider = new MockProvider();
  const reviews = provider.sampleReviews();
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const review of reviews) {
    try {
      await runPipeline(review, provider);
      processed += 1;
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${review.id}: ${message}`);
      console.error(`[seed] review=${review.id} failed: ${message}`);
    }
  }

  console.log(`[seed] done processed=${processed} failed=${failed}`);
  return { ok: failed === 0, processed, failed, errors };
}
