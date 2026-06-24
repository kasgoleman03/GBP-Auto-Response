import { seedDatabase } from "@/server/db/seed";

/**
 * One-time admin utility: seed the DB with the mock provider's sample reviews
 * run through the pipeline (plus default rules/voice). TESTING ONLY.
 *
 *   GET /api/admin/seed?secret=<ADMIN_SECRET>
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
    const result = await seedDatabase();
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/seed] failed:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
