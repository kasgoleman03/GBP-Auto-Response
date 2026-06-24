import { getDb } from "@/server/db";
import { processedLedger } from "@/server/db/schema";
import { seedDatabase, type SeedResult } from "@/server/db/seed";

/**
 * One-time admin utility: clear the processed_ledger table so the mock provider
 * starts fresh during testing. Optionally re-seed sample data with `?seed=true`.
 *
 * TESTING ONLY. Guarded by `?secret=<ADMIN_SECRET>`; returns 401 unless the
 * query secret matches the ADMIN_SECRET env var (which must be set).
 *
 *   GET /api/admin/reset-ledger?secret=...            → clear ledger
 *   GET /api/admin/reset-ledger?secret=...&seed=true  → clear ledger + seed
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const adminSecret = process.env.ADMIN_SECRET;
  const provided = url.searchParams.get("secret");
  const shouldSeed = url.searchParams.get("seed") === "true";

  if (!adminSecret || provided !== adminSecret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await getDb()
      .delete(processedLedger)
      .returning({ id: processedLedger.id });

    let seed: SeedResult | undefined;
    if (shouldSeed) {
      seed = await seedDatabase();
    }

    return Response.json({ ok: true, cleared: deleted.length, seed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/reset-ledger] failed:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
