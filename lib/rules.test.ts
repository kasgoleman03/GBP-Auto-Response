import { test } from "node:test";
import assert from "node:assert/strict";
import { applyNegativeReviewSafety, resolveAction } from "./rules.ts";
import type { Rating, Review, Rule } from "./types.ts";

/**
 * Safety override unit tests: a 1–2 star review must NEVER resolve to auto_post,
 * even when an aggressive "auto-post everything" rule is active.
 */

function makeReview(rating: Rating): Review {
  return {
    id: `rv_${rating}star`,
    reviewerName: "Test Reviewer",
    rating,
    text: rating <= 2 ? "Terrible experience, very disappointed." : "Loved it!",
    hasText: true,
    wordCount: 4,
    date: new Date().toISOString(),
    status: "needs_review",
  };
}

/** A user rule that aggressively auto-posts every review (1–5 stars). */
const autoPostEverything: Rule = {
  id: "rule_auto_all",
  name: "Auto-post everything",
  condition: { minStars: 1, maxStars: 5, minWords: null, maxWords: null, starOnly: false },
  action: "auto_post",
  enabled: true,
};

test("resolveAction never auto-posts a 1-star review", () => {
  const result = resolveAction([autoPostEverything], makeReview(1));
  assert.ok(result, "a rule should match");
  assert.notEqual(result!.action, "auto_post");
  assert.equal(result!.action, "draft");
});

test("resolveAction never auto-posts a 2-star review", () => {
  const result = resolveAction([autoPostEverything], makeReview(2));
  assert.ok(result, "a rule should match");
  assert.notEqual(result!.action, "auto_post");
  assert.equal(result!.action, "draft");
});

test("resolveAction still allows auto-post for a 5-star review", () => {
  const result = resolveAction([autoPostEverything], makeReview(5));
  assert.equal(result!.action, "auto_post");
});

test("applyNegativeReviewSafety downgrades 1-2 stars only", () => {
  assert.equal(applyNegativeReviewSafety(makeReview(1), "auto_post"), "draft");
  assert.equal(applyNegativeReviewSafety(makeReview(2), "auto_post"), "draft");
  assert.equal(applyNegativeReviewSafety(makeReview(3), "auto_post"), "auto_post");
  assert.equal(applyNegativeReviewSafety(makeReview(5), "auto_post"), "auto_post");
  // Non-auto-post actions pass through unchanged.
  assert.equal(applyNegativeReviewSafety(makeReview(1), "notify"), "notify");
});
