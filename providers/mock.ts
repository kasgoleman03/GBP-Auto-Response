import type { ReviewProvider } from "./types";
import type { PostReplyResult, Rating, Review } from "../server/types";
import { ledger } from "../server/ledger";

/**
 * MockProvider — the default. Requires NO external credentials, so the app runs
 * out of the box with REVIEW_PROVIDER=mock. It fabricates a small set of "new"
 * reviews for poll runs (deduped by the ledger after the first pass) and treats
 * replies as instantly published.
 */

function wordCount(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

interface MockRaw {
  id: string;
  reviewerName: string;
  rating: Rating;
  body: string | null;
  avatar?: string;
  postedAt: string;
}

function sampleRaw(): MockRaw[] {
  const now = Date.now();
  const min = (m: number) => new Date(now - m * 60_000).toISOString();
  return [
    {
      id: "mock_rv_5001",
      reviewerName: "Devon Pierce",
      rating: 5,
      body: "Coach pushed me harder than I thought I could go. Hooked after one class!",
      postedAt: min(20),
    },
    {
      id: "mock_rv_5002",
      reviewerName: "Lena Park",
      rating: 2,
      body: "Booked a free intro but no one was at the front desk when I arrived.",
      postedAt: min(75),
    },
    {
      id: "mock_rv_5003",
      reviewerName: "Sam Ortiz",
      rating: 5,
      body: null, // star-only review
      postedAt: min(130),
    },
  ];
}

export class MockProvider implements ReviewProvider {
  readonly name = "mock";

  normalizeInbound(payload: unknown): Review {
    const r = payload as MockRaw;
    const text = r.body ?? "";
    return {
      id: r.id,
      reviewerName: r.reviewerName,
      reviewerAvatarUrl: r.avatar,
      rating: r.rating,
      text,
      hasText: text.trim().length > 0,
      wordCount: wordCount(text),
      date: r.postedAt,
      status: "needs_review",
      meta: { provider: this.name, providerId: r.id },
    };
  }

  async postReply(externalReviewId: string, text: string): Promise<PostReplyResult> {
    const existing = ledger.getReply(externalReviewId);
    if (existing && existing.status !== "failed") {
      return { ok: true, postId: existing.postId, status: existing.status, deduped: true };
    }
    return {
      ok: true,
      postId: `mock_reply_${externalReviewId}`,
      status: "published",
      // text is echoed only to prove the seam is wired; a real provider posts it.
      error: text.trim() === "" ? "empty reply" : undefined,
    };
  }

  async listInbound(): Promise<Review[]> {
    return sampleRaw()
      .filter((r) => !ledger.hasReview(r.id))
      .map((r) => this.normalizeInbound(r));
  }

  /** All sample reviews, ignoring the ledger — used by the DB seed function. */
  sampleReviews(): Review[] {
    return sampleRaw().map((r) => this.normalizeInbound(r));
  }
}
