import type { PostReplyResult, Review } from "../server/types";

/**
 * The provider contract the rest of the system depends on.
 *
 * The two core methods (`normalizeInbound`, `postReply`) match the existing
 * ReviewProvider spec exactly. `listInbound` is the additive seam that POLL
 * mode needs: poll-capable providers fetch new reviews on a schedule, while
 * webhook-only providers can omit it.
 */
export interface ReviewProvider {
  /** Stable name for logging / ledger metadata. */
  readonly name: string;

  /** Map a provider-native review payload to a canonical Review. */
  normalizeInbound(payload: unknown): Review;

  /**
   * Post a reply to a review. Replies are async: a successful call usually
   * resolves with `{ ok: true, status: "pending" }`. Implementations MUST be
   * idempotent (guard against double-posting via the ledger).
   */
  postReply(externalReviewId: string, text: string): Promise<PostReplyResult>;

  /**
   * POLL mode only: list reviews that are genuinely new — i.e. not already in
   * the ledger and without an existing owner reply. Optional so webhook-only
   * providers needn't implement it.
   */
  listInbound?(): Promise<Review[]>;
}
