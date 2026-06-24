import type {
  ActivityEntry,
  Connection,
  Draft,
  InboxStats,
  Review,
  Rule,
  VoiceConfig,
} from "./types";

/**
 * The single seam between the UI and the outside world.
 *
 * Every screen talks to this interface — never to mock data directly. To go
 * live, implement `ReplyPilotApi` against a real backend and swap the export
 * at the bottom of `mockApi.ts`; no UI code needs to change.
 */
export interface ReplyPilotApi {
  // --- Connection / onboarding ---------------------------------------
  getConnection(): Promise<Connection>;
  /** Simulates the Google OAuth + first import. */
  connectGoogle(input: {
    businessName: string;
    locationAddress: string;
    googleAccountEmail: string;
  }): Promise<Connection>;
  disconnect(): Promise<Connection>;

  // --- Inbox / reviews ----------------------------------------------
  getInboxStats(): Promise<InboxStats>;
  listReviews(filter?: ReviewFilter): Promise<Review[]>;
  getReview(reviewId: string): Promise<Review | undefined>;

  // --- Drafts / approval flow ---------------------------------------
  getDraft(reviewId: string): Promise<Draft | undefined>;
  /** Regenerate ("Redo") the AI draft for a review. */
  regenerateDraft(reviewId: string): Promise<Draft>;
  /** Approve & post the current (or supplied) draft text. */
  approveAndPost(reviewId: string, text?: string): Promise<{
    review: Review;
    draft: Draft;
  }>;
  /** Owner wrote their own reply and posted it. */
  postOwnReply(reviewId: string, text: string): Promise<{
    review: Review;
    draft: Draft;
  }>;
  /** Persist an edited draft without posting (autosave). */
  saveDraft(reviewId: string, text: string): Promise<Draft>;
  /** Dismiss a review without replying. */
  skipReview(reviewId: string): Promise<Review>;
  /** Undo a posted reply (undo window): return the review to needs_review. */
  unpostReply(reviewId: string): Promise<{ review: Review; draft: Draft }>;
  /** Undo a skip (undo window): return the review to needs_review. */
  unskipReview(reviewId: string): Promise<Review>;
  /** Reopen a skipped/replied review and generate a fresh draft. */
  reopenReview(reviewId: string): Promise<{ review: Review; draft: Draft }>;

  // --- Rules ---------------------------------------------------------
  listRules(): Promise<Rule[]>;
  saveRule(rule: Rule): Promise<Rule>;
  deleteRule(ruleId: string): Promise<void>;
  reorderRules(orderedIds: string[]): Promise<Rule[]>;

  // --- Voice & brand ------------------------------------------------
  getVoiceConfig(): Promise<VoiceConfig>;
  saveVoiceConfig(config: VoiceConfig): Promise<VoiceConfig>;
  /** Produce a sample reply so the owner can preview their voice settings. */
  previewVoice(config: VoiceConfig, sampleReview: Review): Promise<string>;

  // --- Activity log -------------------------------------------------
  listActivity(): Promise<ActivityEntry[]>;
}

export interface ReviewFilter {
  status?: Review["status"] | "all";
  /** Only reviews at or below this rating (used for "Negative" quick filter). */
  maxRating?: number;
  /** Only reviews at or above this rating. */
  minRating?: number;
  hasText?: boolean;
  search?: string;
}
