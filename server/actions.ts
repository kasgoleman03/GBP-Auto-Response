/**
 * Cross-cutting actions that combine the DB repository with the LLM pipeline
 * (regenerate a draft, preview a voice config). Kept separate from `repo` to
 * avoid a repo → pipeline import cycle.
 */
import * as repo from "./db/repo";
import { generateDraftText } from "./pipeline";
import type { Review as ServerReview } from "./types";
import type { Draft, Review, VoiceConfig } from "../lib/types";

/** Regenerate the AI draft for a review and persist it (in-app "Redo"). */
export async function regenerateAndSave(reviewId: string): Promise<Draft> {
  const review = await repo.getServerReview(reviewId);
  if (!review) throw new Error(`Review ${reviewId} not found`);

  const text = await generateDraftText(review);
  const draft = await repo.upsertDraft({
    reviewId,
    text,
    status: "ready",
    editable: true,
    generatedBy: "ReplyPilot AI",
  });
  await repo.logActivity({
    type: "regenerated",
    summary: `Regenerated the draft for ${review.reviewerName} (${review.rating}★)`,
    reviewId,
    actor: "you",
  });
  return draft;
}

/**
 * Reopen a skipped/replied review (no dead ends): return it to needs_review and
 * generate a fresh draft via the pipeline's generate step.
 */
export async function reopenReview(
  reviewId: string
): Promise<{ review: Review; draft: Draft }> {
  const server = await repo.getServerReview(reviewId);
  if (!server) throw new Error(`Review ${reviewId} not found`);

  const text = await generateDraftText(server);
  const draft = await repo.upsertDraft({
    reviewId,
    text,
    status: "ready",
    editable: true,
    generatedBy: "ReplyPilot AI",
  });
  const review = await repo.setReviewStatus(reviewId, "needs_review");
  await repo.logActivity({
    type: "reopened",
    summary: `Reopened ${review.reviewerName} (${review.rating}★) and drafted a fresh reply`,
    reviewId,
    actor: "you",
  });
  return { review, draft };
}

/** Generate a sample reply for an unsaved voice config (Voice screen preview). */
export async function previewReply(
  config: VoiceConfig,
  sampleReview: Review
): Promise<string> {
  const serverReview: ServerReview = {
    ...sampleReview,
    meta: { provider: "preview" },
  };
  return generateDraftText(serverReview, config);
}
