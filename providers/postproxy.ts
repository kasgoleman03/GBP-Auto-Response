import type { ReviewProvider } from "./types";
import type { PostReplyResult, Rating, Review } from "../server/types";
import { ledger } from "../server/ledger";
import { assertPostproxyConfigured, serverConfig } from "../server/config";

/**
 * Postproxy adapter for Google Business Profile reviews.
 *
 * Verified against Postproxy's live docs (2026-06):
 *   - Base URL:  https://api.postproxy.dev
 *   - Auth:      Authorization: Bearer <POSTPROXY_API_KEY>
 *   - List:      GET /api/profiles/{profileId}/comments?placement_id=accounts/{a}/locations/{l}
 *                  &page=0&per_page=N  (newest-first by posted_at)
 *                Response: { total, page, per_page, data: ProfileComment[] }
 *   - Reply:     POST /api/profiles/{profileId}/comments
 *                  body { parent_id (required), body }  -> 201 { id, status:"pending", ... }
 *                  (422 if parent_id missing)
 *   - Star-only: `body` is null while platform_data.star_rating is set — never skip.
 *   - Each review carries an existing-replies array (`replies[]`); a non-empty
 *     array means the owner already responded.
 *
 * See the end-of-task notes for the few fields that go slightly beyond what the
 * docs spell out explicitly.
 */

interface PostproxyErrorDetails {
  platform_error_code?: string | null;
  platform_error_subcode?: string | null;
  platform_error_message?: string | null;
  postproxy_note?: string | null;
}

interface ProfileComment {
  id: string;
  external_id: string | null;
  parent_external_id: string | null;
  placement_id: string;
  body: string | null;
  status: string;
  error?: string | null;
  error_details?: PostproxyErrorDetails | null;
  author_username: string | null;
  author_avatar_url: string | null;
  platform_data?: { star_rating?: number; update_time?: string } | null;
  permalink?: string | null;
  posted_at: string | null;
  created_at: string;
  replies?: ProfileComment[];
}

interface ListResponse {
  total: number;
  page: number;
  per_page: number;
  data: ProfileComment[];
}

function wordCount(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

function clampRating(value: number | undefined): Rating {
  const n = Math.round(value ?? 0);
  const bounded = Math.min(5, Math.max(1, n));
  return bounded as Rating;
}

export class PostproxyProvider implements ReviewProvider {
  readonly name = "postproxy";

  private get cfg() {
    return serverConfig.postproxy;
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.cfg.apiKey}`,
      Accept: "application/json",
    };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  /**
   * Map a Postproxy ProfileComment (review) to a canonical Review.
   * `id` = the external review id (Google native path), per spec. Star-only
   * reviews (null body) are handled, not skipped.
   */
  normalizeInbound(payload: unknown): Review {
    const c = payload as ProfileComment;
    // Prefer the platform-native external id; fall back to the Postproxy hashid.
    const externalId = c.external_id ?? c.id;
    const text = c.body ?? "";
    return {
      id: externalId,
      reviewerName: c.author_username ?? "Anonymous",
      reviewerAvatarUrl: c.author_avatar_url ?? undefined,
      rating: clampRating(c.platform_data?.star_rating),
      text,
      hasText: text.trim().length > 0,
      wordCount: wordCount(text),
      date: c.posted_at ?? c.created_at,
      status: "needs_review",
      meta: {
        provider: this.name,
        placementId: c.placement_id,
        providerId: c.id,
        permalink: c.permalink ?? undefined,
      },
    };
  }

  /** True if the review already has an owner reply we shouldn't duplicate. */
  private hasOwnerReply(c: ProfileComment): boolean {
    return Array.isArray(c.replies) && c.replies.length > 0;
  }

  /**
   * POLL: list reviews for the configured location, drop anything already
   * replied-to (replies[]) or already in the ledger, and return the genuinely
   * new ones as canonical Reviews.
   */
  async listInbound(): Promise<Review[]> {
    assertPostproxyConfigured();
    const fresh: Review[] = [];
    let page = 0;

    while (page < this.cfg.maxPollPages) {
      const url = new URL(
        `/api/profiles/${this.cfg.profileId}/comments`,
        this.cfg.baseUrl
      );
      url.searchParams.set("placement_id", this.cfg.placementId);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(this.cfg.perPage));

      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) {
        throw new Error(
          `Postproxy list failed: ${res.status} ${await safeText(res)}`
        );
      }
      const body = (await res.json()) as ListResponse;
      const items = body.data ?? [];

      for (const c of items) {
        // Defensive scoping: only ever process the configured location.
        if (c.placement_id !== this.cfg.placementId) continue;
        // Skip the owner's own reply records (they aren't top-level reviews).
        if (c.parent_external_id) continue;
        if (this.hasOwnerReply(c)) continue;
        const review = this.normalizeInbound(c);
        if (ledger.hasReview(review.id)) continue;
        fresh.push(review);
      }

      const seen = (body.page + 1) * body.per_page;
      if (items.length === 0 || seen >= body.total) break;
      page += 1;
    }

    return fresh;
  }

  /**
   * Reply to a review. `parent_id` is REQUIRED by Postproxy (422 otherwise).
   * Replies are async: success returns status "pending". We guard against
   * double-posting via the ledger and surface failure details for retry/notify.
   */
  async postReply(externalReviewId: string, text: string): Promise<PostReplyResult> {
    assertPostproxyConfigured();

    // Idempotency: never post twice for the same review.
    const existing = ledger.getReply(externalReviewId);
    if (existing && existing.status !== "failed") {
      return {
        ok: true,
        postId: existing.postId,
        status: existing.status,
        deduped: true,
      };
    }

    const url = new URL(
      `/api/profiles/${this.cfg.profileId}/comments`,
      this.cfg.baseUrl
    );
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({ parent_id: externalReviewId, body: text }),
    });

    if (!res.ok) {
      const detail = await safeJson(res);
      return {
        ok: false,
        status: String(res.status),
        error:
          (detail && typeof detail === "object" && "error" in detail
            ? String((detail as { error: unknown }).error)
            : undefined) ?? `Postproxy reply failed (${res.status})`,
        errorDetails: detail,
      };
    }

    const created = (await res.json()) as ProfileComment;
    const failed =
      created.status === "failed" || created.status === "failed_waiting_for_retry";

    return {
      ok: !failed,
      postId: created.id,
      status: created.status,
      error: failed ? created.error ?? "reply failed" : undefined,
      errorDetails: failed ? created.error_details ?? undefined : undefined,
    };
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
