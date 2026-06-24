/**
 * Domain types for ReplyPilot.
 *
 * These mirror the shape a real backend (Google Business Profile + an AI
 * drafting service) would return. The mock data layer in `lib/api.ts` is the
 * only place that fabricates them, so swapping in a real API later means
 * re-implementing the `ReplyPilotApi` interface and nothing else.
 */

export type Rating = 1 | 2 | 3 | 4 | 5;

/**
 * Lifecycle of a single review as ReplyPilot sees it.
 * - `needs_review`  : AI draft is waiting for the owner to approve/edit.
 * - `auto_posted`   : a rule auto-posted the AI reply, no human touched it.
 * - `posted`        : the owner approved (or wrote) a reply that is now live.
 * - `notify_only`   : owner was notified but no draft/action is expected.
 * - `skipped`       : owner chose not to reply.
 */
export type ReviewStatus =
  | "needs_review"
  | "auto_posted"
  | "posted"
  | "notify_only"
  | "skipped";

export interface Review {
  id: string;
  reviewerName: string;
  reviewerAvatarUrl?: string;
  rating: Rating;
  /** Raw review body. Empty string when the customer left only a star rating. */
  text: string;
  /** True when `text` has meaningful content (star-only reviews are common). */
  hasText: boolean;
  wordCount: number;
  /** ISO 8601 timestamp of when the review was left. */
  date: string;
  status: ReviewStatus;
}

export type DraftStatus =
  | "generating"
  | "ready"
  | "edited"
  | "posted"
  | "failed";

export interface Draft {
  reviewId: string;
  text: string;
  status: DraftStatus;
  /** Whether the owner is allowed to edit before posting. */
  editable: boolean;
  /** Which AI persona/voice produced this draft (for transparency). */
  generatedBy?: string;
  /** ISO timestamp of the latest (re)generation. */
  updatedAt?: string;
}

/** What a rule does once its condition matches. */
export type RuleAction = "auto_post" | "draft" | "notify";

export interface RuleCondition {
  minStars: Rating;
  maxStars: Rating;
  /** Inclusive word-count floor. `null` means no lower bound. */
  minWords: number | null;
  /** Inclusive word-count ceiling. `null` means no upper bound. */
  maxWords: number | null;
  /** When true, the rule only matches star-only reviews (no text). */
  starOnly: boolean;
}

export interface Rule {
  id: string;
  /** Short human label shown in the rules list. */
  name: string;
  condition: RuleCondition;
  action: RuleAction;
  enabled: boolean;
  /** Built-in safety rules (e.g. negative reviews) can't be deleted. */
  locked?: boolean;
  /**
   * The permanent fallback rule. It is pinned to the bottom of the list,
   * matches anything no earlier rule caught, and can be reconfigured but
   * never deleted — so no review is ever left unrouted.
   */
  catchAll?: boolean;
}

export interface VoiceConfig {
  /** Free-text description of the brand voice for the AI. */
  voiceDescription: string;
  /** Optional fixed sign-off appended to replies, e.g. "— The Vanguard Team". */
  signOff: string;
  allowEmoji: boolean;
  /** Address reviewers by their first name when available. */
  useFirstName: boolean;
  /** Overall tone the AI should aim for. */
  tone: VoiceTone;
  /** Rough cap on reply length. */
  length: ReplyLength;
  /** Phrases/topics the AI must never use. */
  bannedPhrases: string[];
  /** The business name the AI represents. */
  businessName: string;
  /** Whether to invite unhappy reviewers to reach out privately. */
  offerToMakeItRight: boolean;
}

export type VoiceTone =
  | "warm"
  | "professional"
  | "friendly"
  | "playful"
  | "concise";

export type ReplyLength = "short" | "medium" | "long";

/** A single entry in the activity log / audit trail. */
export type ActivityType =
  | "auto_posted"
  | "approved"
  | "edited_and_posted"
  | "regenerated"
  | "skipped"
  | "rule_changed"
  | "voice_changed"
  | "connected"
  | "notified"
  | "reverted"
  | "reopened";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  /** Human-readable summary shown in the log. */
  summary: string;
  /** Optional richer detail (e.g. the reply text that was posted). */
  detail?: string;
  /** ISO timestamp. */
  date: string;
  reviewId?: string;
  /** "you" for owner actions, "system" for automated ones. */
  actor: "you" | "system";
}

/** State of the Google Business Profile connection. */
export interface Connection {
  status: "disconnected" | "connecting" | "connected";
  businessName?: string;
  locationAddress?: string;
  googleAccountEmail?: string;
  connectedAt?: string;
  /** How many historical reviews were imported on connect. */
  importedReviewCount?: number;
}

/** Aggregate numbers for the inbox header / dashboard. */
export interface InboxStats {
  needsReview: number;
  autoPostedThisWeek: number;
  averageRating: number;
  totalReviews: number;
  /** Reviews that still have no reply (awaiting approval or notify-only). */
  withoutReply: number;
  /** Mocked timestamp of the last sync with Google Business Profile. */
  lastSyncedAt: string;
}
