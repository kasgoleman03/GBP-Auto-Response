import { getDb } from "@/server/db";
import { processedLedger } from "@/server/db/schema";

/**
 * One-time admin utility: clear the processed_ledger table so the mock provider
 * starts fresh during testing.
 *
 * TESTING ONLY. Guarded by `?secret=<ADMIN_SECRET>`; returns 401 unless the
 * query secret matches the ADMIN_SECRET env var (which must be set).
 *
 *   GET /api/admin/reset-ledger?secret=...
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const adminSecret = process.env.ADMIN_SECRET;
  const provided = new URL(req.url).searchParams.get("secret");

  if (!adminSecret || provided !== adminSecret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await getDb()
      .delete(processedLedger)
      .returning({ id: processedLedger.id });

    return Response.json({ ok: true, cleared: deleted.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/reset-ledger] failed:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
