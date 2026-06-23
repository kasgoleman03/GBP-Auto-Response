import type { Review, Rule, RuleAction } from "./types";

export const ACTION_LABEL: Record<RuleAction, string> = {
  auto_post: "Auto-post",
  draft: "Draft for approval",
  notify: "Notify only",
};

export const ACTION_DESCRIPTION: Record<RuleAction, string> = {
  auto_post: "ReplyPilot posts the AI reply immediately, hands-free.",
  draft: "ReplyPilot drafts a reply and waits for your approval.",
  notify: "ReplyPilot just tells you — no reply is drafted.",
};

/** Does a review satisfy a rule's condition? */
export function ruleMatches(rule: Rule, review: Review): boolean {
  const { condition: c } = rule;
  if (review.rating < c.minStars || review.rating > c.maxStars) return false;
  if (c.starOnly && review.hasText) return false;
  if (c.minWords != null && review.wordCount < c.minWords) return false;
  if (c.maxWords != null && review.wordCount > c.maxWords) return false;
  return true;
}

/**
 * The first enabled rule that matches wins (rules are evaluated top-to-bottom).
 * Returns `undefined` when nothing matches (the UI treats that as "draft").
 */
export function resolveAction(
  rules: Rule[],
  review: Review
): { rule: Rule; action: RuleAction } | undefined {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (ruleMatches(rule, review)) return { rule, action: rule.action };
  }
  return undefined;
}

/** Human summary of a rule condition, e.g. "1–2 stars, any length". */
export function describeCondition(rule: Rule): string {
  const { condition: c } = rule;
  const stars =
    c.minStars === c.maxStars
      ? `${c.minStars}★`
      : `${c.minStars}–${c.maxStars}★`;
  if (c.starOnly) return `${stars}, rating only (no text)`;
  let words = "any length";
  if (c.minWords != null && c.maxWords != null)
    words = `${c.minWords}–${c.maxWords} words`;
  else if (c.minWords != null) words = `${c.minWords}+ words`;
  else if (c.maxWords != null) words = `under ${c.maxWords + 1} words`;
  return `${stars}, ${words}`;
}
