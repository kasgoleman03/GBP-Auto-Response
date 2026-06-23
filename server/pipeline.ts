/**
 * Review-processing pipeline seam: analyze → rules → generate → self-check → route.
 *
 * This is a minimal, self-contained stand-in so the providers have something to
 * call end-to-end. In the real system this is the existing pipeline; a provider
 * adapter must never need to modify it. Everything here is intentionally small
 * and dependency-light (no LLM calls, no DB) and records to the ledger/notifier
 * seams so idempotency and alerting are honored.
 */

import type { ReviewProvider } from "../providers/types";
import type { Review } from "./types";
import { ledger } from "./ledger";
import { notify } from "./notifier";

type Action = "auto_post" | "draft" | "notify";

const BANNED_PHRASES = ["valued customer", "we apologize for any inconvenience"];

/** analyze: cheap sentiment read from the rating. */
function analyze(review: Review): { negative: boolean; starOnly: boolean } {
  return { negative: review.rating <= 2, starOnly: !review.hasText };
}

/** rules: graduated autonomy. Negative reviews always go to a human. */
function decide(review: Review): Action {
  const { negative, starOnly } = analyze(review);
  if (negative) return "draft";
  if (starOnly) return "notify";
  if (review.rating === 5 && review.wordCount <= 15) return "auto_post";
  return "draft";
}

/** generate: produce a draft reply (template stand-in for the real generator). */
function generate(review: Review): string {
  const name = review.reviewerName.split(/\s+/)[0] || "";
  const greeting = name ? `${name}, ` : "";
  if (review.rating <= 2) {
    return `${greeting}we're sorry your experience missed the mark — please reach out so we can make it right.`;
  }
  if (!review.hasText) {
    return `Thanks for the ${review.rating}-star rating${name ? `, ${name}` : ""}! We appreciate you.`;
  }
  return `${greeting}thank you for the awesome review — we're pumped to have you training with us!`;
}

/** self-check: block empty/over-long/off-brand drafts from auto-posting. */
function selfCheck(text: string): { ok: boolean; issue?: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, issue: "empty draft" };
  if (trimmed.length > 1200) return { ok: false, issue: "draft too long" };
  const lower = trimmed.toLowerCase();
  const banned = BANNED_PHRASES.find((p) => lower.includes(p));
  if (banned) return { ok: false, issue: `banned phrase: ${banned}` };
  return { ok: true };
}

export interface PipelineResult {
  reviewId: string;
  action: Action;
  posted: boolean;
  deduped: boolean;
  status?: string;
  error?: string;
}

/**
 * Run the full pipeline for one review. Idempotent: if the review is already in
 * the ledger it is skipped. `auto_post` routes through the provider's reply API
 * (with its own double-post guard); other actions record + notify only.
 */
export async function runPipeline(
  review: Review,
  provider: ReviewProvider
): Promise<PipelineResult> {
  if (ledger.hasReview(review.id)) {
    return { reviewId: review.id, action: "draft", posted: false, deduped: true };
  }

  const action = decide(review);
  const draft = generate(review);
  const now = new Date().toISOString();

  if (action === "auto_post") {
    const check = selfCheck(draft);
    if (!check.ok) {
      // Failed self-check downgrades to human approval — never silently drop.
      ledger.recordReview({ reviewId: review.id, action: "draft", draft, processedAt: now });
      await notify({
        kind: "needs_approval",
        reviewId: review.id,
        message: `Auto-post blocked by self-check (${check.issue}); routed for approval.`,
      });
      return { reviewId: review.id, action: "draft", posted: false, deduped: false };
    }

    const result = await provider.postReply(review.id, draft);
    const failed =
      result.status === "failed" || result.status === "failed_waiting_for_retry";

    ledger.recordReply({
      reviewId: review.id,
      postId: result.postId,
      status: (result.status as never) ?? (result.ok ? "pending" : "failed"),
      error: result.error,
      errorDetails: result.errorDetails,
      needsAttention: !result.ok || failed,
      updatedAt: now,
    });
    ledger.recordReview({ reviewId: review.id, action, draft, processedAt: now });

    if (!result.ok || failed) {
      await notify({
        kind: "reply_failed",
        reviewId: review.id,
        message: `Auto-post failed (${result.error ?? result.status}); marked for retry.`,
        detail: result.errorDetails,
      });
      return {
        reviewId: review.id,
        action,
        posted: false,
        deduped: !!result.deduped,
        status: result.status,
        error: result.error,
      };
    }

    if (!result.deduped) {
      await notify({
        kind: "auto_posted",
        reviewId: review.id,
        message: `Auto-posted reply (status: ${result.status ?? "pending"}).`,
      });
    }
    return {
      reviewId: review.id,
      action,
      posted: true,
      deduped: !!result.deduped,
      status: result.status,
    };
  }

  // draft / notify: record and alert; the coach acts from the app.
  ledger.recordReview({ reviewId: review.id, action, draft, processedAt: now });
  await notify({
    kind: action === "notify" ? "notify_only" : "needs_approval",
    reviewId: review.id,
    message:
      action === "notify"
        ? "New rating-only review — no reply drafted."
        : "New review drafted and waiting for your approval.",
  });
  return { reviewId: review.id, action, posted: false, deduped: false };
}
