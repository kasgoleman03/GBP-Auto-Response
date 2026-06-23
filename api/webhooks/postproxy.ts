import { getProvider } from "../../providers";
import { runPipeline } from "../../server/pipeline";
import { ledger } from "../../server/ledger";
import { rateLimit } from "../../server/rateLimit";
import { serverConfig } from "../../server/config";
import { verifyPostproxySignature } from "../../server/webhookSignature";

/**
 * Postproxy webhook receiver — `profile_comment.created`.
 *
 * (Maps the Next.js spec path `app/api/webhooks/postproxy/route.ts` to this
 * Vite+Vercel function at `/api/webhooks/postproxy`.)
 *
 * Runtime: Edge — `Request.text()` gives the exact raw body required for HMAC
 * signature verification, and Web Crypto is available. Steps:
 *   1. rate-limit  2. verify X-Postproxy-Signature  3. parse + filter event
 *   4. scope to the configured placement  5. dedup (delivery id + ledger)
 *   6. normalize + run pipeline.
 *
 * Only acts in INGEST_MODE "webhook" | "both"; in "poll" it acknowledges and
 * ignores so the poll cron remains the single processor.
 */
export const config = { runtime: "edge" };

interface ProfileCommentEvent {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  // 1. Rate limit (per client IP, best-effort on Edge isolates).
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`pp_webhook:${ip}`, 120, 60_000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
      },
    });
  }

  // 2. Verify signature over the raw body.
  const rawBody = await req.text();
  const sig = await verifyPostproxySignature({
    rawBody,
    signatureHeader: req.headers.get("x-postproxy-signature"),
    secret: serverConfig.postproxy.webhookSecret,
    toleranceSeconds: serverConfig.postproxy.webhookToleranceSeconds,
  });
  if (!sig.valid) {
    return json({ ok: false, error: `invalid_signature:${sig.reason}` }, 401);
  }

  // Acknowledge-and-ignore when webhooks aren't the active ingestion path.
  if (serverConfig.ingestMode === "poll") {
    return json({ ok: true, ignored: "ingest_mode_poll" });
  }

  // 3. Parse + filter to new reviews only.
  let event: ProfileCommentEvent;
  try {
    event = JSON.parse(rawBody) as ProfileCommentEvent;
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  if (event.type !== "profile_comment.created") {
    return json({ ok: true, ignored: `event_type:${event.type ?? "unknown"}` });
  }

  const obj = event.data?.object;
  if (!obj) return json({ ok: true, ignored: "no_object" });

  // The event also fires for our own published replies — skip those.
  if (obj.parent_external_id) return json({ ok: true, ignored: "is_reply" });

  // 4. Location scoping — only ever process the configured gym.
  if (obj.placement_id !== serverConfig.postproxy.placementId) {
    return json({ ok: true, ignored: "other_location" });
  }

  // 5. Idempotency: delivery id (replay) + review id (already processed).
  const deliveryId = req.headers.get("x-postproxy-delivery") ?? event.id ?? "";
  if (deliveryId && ledger.hasDelivery(deliveryId)) {
    return json({ ok: true, deduped: "delivery" });
  }

  const provider = getProvider();
  const review = provider.normalizeInbound(obj);
  if (ledger.hasReview(review.id)) {
    if (deliveryId) ledger.recordDelivery(deliveryId);
    return json({ ok: true, deduped: "review" });
  }

  // 6. Run the pipeline.
  try {
    const result = await runPipeline(review, provider);
    if (deliveryId) ledger.recordDelivery(deliveryId);
    return json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhooks/postproxy] pipeline failed:", message);
    // 500 so Postproxy retries delivery (up to 5x with backoff).
    return json({ ok: false, error: message }, 500);
  }
}
