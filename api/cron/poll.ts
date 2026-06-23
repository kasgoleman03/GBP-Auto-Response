import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProvider } from "../../providers";
import { runPipeline } from "../../server/pipeline";
import { serverConfig } from "../../server/config";

/**
 * Cron-driven POLL ingestion (the free-tier happy path, always available as a
 * safety net even when webhooks are on).
 *
 * Scheduled via `crons` in vercel.json. Lists new reviews for the scoped
 * location through the active provider, filters out anything already handled
 * (ledger) or already replied-to (handled inside the provider), and runs the
 * pipeline for each genuinely new review.
 *
 * Runtime: Node.js (default). Postproxy syncs from Google ~twice daily, so a
 * daily cron (Hobby limit) fully covers poll mode; Pro can run it twice daily.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Optional but recommended: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  if (serverConfig.cronSecret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${serverConfig.cronSecret}`) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
  }

  const provider = getProvider();
  const startedAt = new Date().toISOString();

  // A webhook-only provider may not implement listInbound.
  if (typeof provider.listInbound !== "function") {
    return res.status(200).json({
      ok: true,
      mode: serverConfig.ingestMode,
      provider: provider.name,
      message: "Provider does not support polling; nothing to do.",
      startedAt,
    });
  }

  try {
    const reviews = await provider.listInbound();
    const results = [];
    for (const review of reviews) {
      results.push(await runPipeline(review, provider));
    }

    const processed = results.filter((r) => !r.deduped).length;
    const posted = results.filter((r) => r.posted).length;
    const deduped = results.filter((r) => r.deduped).length;

    return res.status(200).json({
      ok: true,
      mode: serverConfig.ingestMode,
      provider: provider.name,
      found: reviews.length,
      processed,
      posted,
      deduped,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/poll] failed:", message);
    return res
      .status(500)
      .json({ ok: false, provider: provider.name, error: message });
  }
}
