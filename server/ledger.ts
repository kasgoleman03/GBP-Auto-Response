/**
 * Processed-review ledger seam.
 *
 * Records which reviews have been processed and the state of any reply we
 * posted, plus webhook delivery ids for idempotency. This is the dedup
 * authority: the pipeline and providers check it before acting so we never
 * post twice.
 *
 * NOTE: the default implementation is in-memory and therefore ephemeral on
 * serverless (each invocation may get a fresh instance). It is correct within a
 * single invocation and good enough for the mock path and local dev. For
 * production, implement `Ledger` against a durable store (Vercel KV, Postgres,
 * Upstash Redis) and export that instead — nothing else changes.
 */

export type ReplyState = "pending" | "published" | "failed" | "failed_waiting_for_retry";

export interface ReplyRecord {
  reviewId: string;
  postId?: string;
  status: ReplyState;
  error?: string;
  errorDetails?: unknown;
  /** True when this reply needs operator attention (failed states). */
  needsAttention?: boolean;
  updatedAt: string;
}

export interface ReviewRecord {
  reviewId: string;
  action: "auto_post" | "draft" | "notify";
  draft?: string;
  processedAt: string;
}

export interface Ledger {
  hasReview(reviewId: string): boolean;
  recordReview(rec: ReviewRecord): void;
  getReply(reviewId: string): ReplyRecord | undefined;
  recordReply(rec: ReplyRecord): void;
  hasDelivery(deliveryId: string): boolean;
  recordDelivery(deliveryId: string): void;
}

class InMemoryLedger implements Ledger {
  private reviews = new Map<string, ReviewRecord>();
  private replies = new Map<string, ReplyRecord>();
  private deliveries = new Set<string>();

  hasReview(reviewId: string): boolean {
    return this.reviews.has(reviewId) || this.replies.has(reviewId);
  }
  recordReview(rec: ReviewRecord): void {
    this.reviews.set(rec.reviewId, rec);
  }
  getReply(reviewId: string): ReplyRecord | undefined {
    return this.replies.get(reviewId);
  }
  recordReply(rec: ReplyRecord): void {
    this.replies.set(rec.reviewId, rec);
  }
  hasDelivery(deliveryId: string): boolean {
    return this.deliveries.has(deliveryId);
  }
  recordDelivery(deliveryId: string): void {
    this.deliveries.add(deliveryId);
  }
}

export const ledger: Ledger = new InMemoryLedger();
