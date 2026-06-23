/**
 * Server-side canonical types for the review integration layer.
 *
 * These intentionally mirror the front-end's `src/lib/types.ts` Review shape so
 * the two stay compatible, but they are defined separately to keep the server
 * (serverless functions) self-contained and decoupled from the Vite app build.
 * The front-end is never imported here, and these types are never modified by
 * provider adapters.
 */

export type Rating = 1 | 2 | 3 | 4 | 5;

export type ReviewStatus =
  | "needs_review"
  | "auto_posted"
  | "posted"
  | "notify_only"
  | "skipped";

/** The canonical review the pipeline operates on, regardless of provider. */
export interface Review {
  /** Stable external review id (provider's native id for the review). */
  id: string;
  reviewerName: string;
  reviewerAvatarUrl?: string;
  rating: Rating;
  /** Empty string for star-only reviews. */
  text: string;
  hasText: boolean;
  wordCount: number;
  /** ISO 8601 timestamp the review was posted. */
  date: string;
  status: ReviewStatus;
  /** Provider-specific scoping/debug metadata (never required by the pipeline). */
  meta?: {
    provider: string;
    placementId?: string;
    /** Provider's internal id (e.g. Postproxy hashid) when different from `id`. */
    providerId?: string;
    permalink?: string;
  };
}

/** Result of attempting to post a reply through a provider. */
export interface PostReplyResult {
  ok: boolean;
  /** The provider's id for the created reply record, when available. */
  postId?: string;
  /**
   * Async lifecycle status from the provider, e.g. "pending" | "published" |
   * "failed" | "failed_waiting_for_retry". Replies are async, so a successful
   * call typically returns "pending".
   */
  status?: string;
  /** Human-readable error summary on failure. */
  error?: string;
  /** Structured platform error details, surfaced for retry/notify. */
  errorDetails?: unknown;
  /** True when we short-circuited because a reply already exists (idempotency). */
  deduped?: boolean;
}
