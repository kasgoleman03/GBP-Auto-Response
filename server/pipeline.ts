/**
 * Review-processing pipeline: analyze → rules → generate → self-check → route.
 *
 * The three Claude stages (analyze/generate/self-check) run on claude-haiku-4-5.
 * Voice & Brand config is loaded per-run from the DB `config` table (key
 * "voice") and injected into every system prompt. The pipeline records to the
 * ledger/notifier seams so idempotency and alerting are honored; a provider
 * adapter must never need to modify it.
 */

import type { ReviewProvider } from "../providers/types";
import type { Review } from "./types";
import { ledger } from "./ledger";
import { notify, type Notification } from "./notifier";
import { callClaude, parseClaudeJson } from "./anthropic";
import { loadVoiceConfig, buildVoiceBlock } from "./voice";

type Action = "auto_post" | "draft" | "notify";

// Startup diagnostic (runs once per cold start). Logs presence ONLY — never the value.
console.log(
  `[pipeline] startup — ANTHROPIC_API_KEY present: ${Boolean(
    process.env.ANTHROPIC_API_KEY
  )}`
);

function errToString(err: unknown): string {
  return err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
}

// ── Prompts ──────────────────────────────────────────────────────────────────
// Each stage's system prompt = the per-run voice block (from the DB `config`
// table) + the stage-specific Role/Task/Constraints instructions below.

type RatingBand = "5star" | "4star" | "3star" | "negative" | "star-only";

function ratingBand(review: Review): RatingBand {
  if (!review.hasText) return "star-only";
  if (review.rating >= 5) return "5star";
  if (review.rating === 4) return "4star";
  if (review.rating === 3) return "3star";
  return "negative";
}

const ANALYZE_INSTRUCTIONS = `STAGE 1 — ANALYZE
ROLE: You are the analysis component ONLY. You never write, draft, or suggest replies.
TASK: Read the customer's Google review and extract structured signal: rating, sentiment,
specific details, risk flags, authenticity, and a recommended angle. Output JSON only.
CONSTRAINTS:
- Never fabricate details that are not present in the review.
- Set "requires_human" to true for ANY content involving injury, safety, legal threats,
  harassment, or refunds/chargebacks.
- Detect star-only reviews (a rating with no text) and set "star_only" accordingly.

Respond with ONLY a JSON object (no markdown, no commentary) in exactly this shape:
{
  "rating": number,                                 // echo the star rating, 1-5
  "sentiment": "positive" | "neutral" | "negative",
  "star_only": boolean,                             // true when the review has no text
  "specific_details": string[],                     // concrete things mentioned (coaches, classes, equipment…) — never invented
  "risk_flags": string[],                           // any of: "injury","safety","legal","harassment","refund" (empty if none)
  "requires_human": boolean,                        // true if any injury/safety/legal/harassment/refund content
  "authenticity": "genuine" | "suspicious" | "spam",
  "recommended_angle": string                       // one short phrase: how a reply should approach this review
}`;

function generateInstructions(band: RatingBand): string {
  return `STAGE 2 — GENERATE
ROLE: You ARE the coach, writing a public reply on Google in your own voice (per the VOICE & BRAND block above).
TASK: Write ONE short reply (2-4 sentences, UNDER 60 words) tuned to this rating band: ${band}.
CONSTRAINTS:
- Echo at least one specific detail from the review. Never invent details.
- Never admit fault or legal liability.
- No phone numbers, email addresses, URLs, or hashtags.
- No generic openers like "thank you for your kind words" or "thanks for the review".
- For star-only reviews, vary the structure so replies never sound templated.
- Follow the VOICE & BRAND block exactly (tone, length, emoji, sign-off, banned phrases).

Respond with ONLY a JSON object (no markdown, no commentary) in exactly this shape:
{ "reply": string }`;
}

const SELFCHECK_INSTRUCTIONS = `STAGE 3 — SELF-CHECK
ROLE: You are a compliance gate. You do NOT rewrite the reply — you ONLY judge it.
TASK: Return a verdict of "pass" or "revise". When revising, list the specific issues found.
CONSTRAINTS — return "revise" if the reply:
- is empty, not 2-4 sentences, or exceeds ~60 words
- admits fault or legal liability
- contains contact details (phone number, email, URL, or hashtag)
- is generic boilerplate or uses a cliché/banned opener
- does not match the VOICE & BRAND block (tone, sign-off, banned phrases)
- is a near-duplicate of one of the recent replies provided

Respond with ONLY a JSON object (no markdown, no commentary) in exactly this shape:
{ "verdict": "pass" | "revise", "issues": string[] }   // "issues" is [] when verdict is "pass"`;

interface AnalyzeResult {
  rating: number;
  sentiment: "positive" | "neutral" | "negative";
  star_only: boolean;
  specific_details: string[];
  risk_flags: string[];
  requires_human: boolean;
  authenticity: "genuine" | "suspicious" | "spam";
  recommended_angle: string;
}

interface GenerateResult {
  reply: string;
}

interface SelfCheckResult {
  verdict: "pass" | "revise";
  issues: string[];
}

/** Render the review into a compact context block for the user message. */
function reviewContext(review: Review): string {
  return [
    `Reviewer: ${review.reviewerName || "(anonymous)"}`,
    `Star rating: ${review.rating}/5`,
    review.hasText
      ? `Review text: """${review.text}"""`
      : "Review text: (star-only review, no text)",
  ].join("\n");
}

/** Stage 1 — analyze sentiment/intent/risk via Claude. Temperature 0.1. */
async function analyze(
  review: Review,
  voiceBlock: string
): Promise<AnalyzeResult> {
  const raw = await callClaude({
    system: `${voiceBlock}\n\n${ANALYZE_INSTRUCTIONS}`,
    user: reviewContext(review),
    temperature: 0.1,
    maxTokens: 400,
  });
  return parseClaudeJson<AnalyzeResult>(raw, "Stage 1 analyze");
}

/** rules: graduated autonomy. Negative/sensitive reviews always go to a human. */
function decide(review: Review, analysis: AnalyzeResult): Action {
  const starOnly = !review.hasText;
  if (
    analysis.requires_human ||
    analysis.sentiment === "negative" ||
    review.rating <= 2
  ) {
    return "draft";
  }
  if (starOnly) return "notify";
  if (review.rating === 5 && review.wordCount <= 15) return "auto_post";
  return "draft";
}

/** Stage 2 — generate an on-brand draft reply via Claude. Temperature 0.6. */
async function generate(
  review: Review,
  analysis: AnalyzeResult,
  band: RatingBand,
  voiceBlock: string
): Promise<GenerateResult> {
  const user = `${reviewContext(review)}

Rating band: ${band}
Specific details to echo (do not invent more): ${
    analysis.specific_details.join("; ") || "none"
  }
Recommended angle: ${analysis.recommended_angle || "n/a"}

Write the reply now.`;
  const raw = await callClaude({
    system: `${voiceBlock}\n\n${generateInstructions(band)}`,
    user,
    temperature: 0.6,
    maxTokens: 400,
  });
  return parseClaudeJson<GenerateResult>(raw, "Stage 2 generate");
}

/** Stage 3 — judge whether the draft is safe to auto-post via Claude. Temperature 0.0. */
async function selfCheck(
  review: Review,
  draft: string,
  voiceBlock: string,
  recentReplies: string[]
): Promise<SelfCheckResult> {
  const recent =
    recentReplies.length > 0
      ? recentReplies.map((r, i) => `${i + 1}. "${r}"`).join("\n")
      : "(none provided)";
  const user = `${reviewContext(review)}

Recent replies (avoid near-duplicates):
${recent}

Drafted reply to evaluate:
"""${draft}"""`;
  const raw = await callClaude({
    system: `${voiceBlock}\n\n${SELFCHECK_INSTRUCTIONS}`,
    user,
    temperature: 0.0,
    maxTokens: 400,
  });
  return parseClaudeJson<SelfCheckResult>(raw, "Stage 3 self-check");
}

export interface PipelineResult {
  reviewId: string;
  action: Action;
  posted: boolean;
  deduped: boolean;
  status?: string;
  error?: string;
}

/**
 * Run the full pipeline for one review. Idempotent: if the review is already in
 * the ledger it is skipped. `auto_post` routes through the provider's reply API
 * (with its own double-post guard); other actions record + notify only.
 */
export async function runPipeline(
  review: Review,
  provider: ReviewProvider
): Promise<PipelineResult> {
  // 1. Review picked up for processing.
  console.log(
    `[pipeline] picked up review=${review.id} rating=${review.rating} hasText=${review.hasText} reviewer="${review.reviewerName}" provider=${provider.name}`
  );

  // Wrap notify so every email send is logged before/after with full errors.
  const sendNotification = async (n: Notification): Promise<void> => {
    console.log(
      `[pipeline] notification send: before kind=${n.kind} review=${n.reviewId}`
    );
    try {
      await notify(n);
      console.log(
        `[pipeline] notification send: after kind=${n.kind} review=${n.reviewId}`
      );
    } catch (err) {
      console.error(
        `[pipeline] notification send: ERROR kind=${n.kind} review=${n.reviewId}: ${errToString(err)}`
      );
    }
  };

  try {
    if (ledger.hasReview(review.id)) {
      console.log(
        `[pipeline] review=${review.id} already in ledger — skipping (deduped)`
      );
      return { reviewId: review.id, action: "draft", posted: false, deduped: true };
    }

    // Load Voice & Brand config from the DB (key "voice") for this run.
    const voice = await loadVoiceConfig();
    const voiceBlock = buildVoiceBlock(voice);
    console.log(
      `[pipeline] review=${review.id} voice config loaded business="${voice.businessName}" tone=${voice.tone} length=${voice.length}`
    );

    // 2. Stage 1 — analyze (Claude, temp 0.1).
    console.log(`[pipeline] review=${review.id} Stage 1 analyze: before (Claude)`);
    const analysis = await analyze(review, voiceBlock);
    console.log(
      `[pipeline] review=${review.id} Stage 1 analyze: after sentiment=${analysis.sentiment} requires_human=${analysis.requires_human} risk_flags=[${analysis.risk_flags.join(",")}] authenticity=${analysis.authenticity}`
    );

    const action = decide(review, analysis);
    console.log(`[pipeline] review=${review.id} decided action=${action}`);

    // 3. Stage 2 — generate (Claude, temp 0.6).
    const band = ratingBand(review);
    console.log(
      `[pipeline] review=${review.id} Stage 2 generate: before (Claude, band=${band})`
    );
    const generated = await generate(review, analysis, band, voiceBlock);
    const draft = generated.reply;
    console.log(
      `[pipeline] review=${review.id} Stage 2 generate: after (draft length=${draft.length})`
    );

    const now = new Date().toISOString();

    if (action === "auto_post") {
      // 4. Stage 3 — self-check (Claude, temp 0.0).
      // TODO: pass real recent replies (from the ledger/DB) for near-duplicate detection.
      const recentReplies: string[] = [];
      console.log(`[pipeline] review=${review.id} Stage 3 self-check: before (Claude)`);
      const sc = await selfCheck(review, draft, voiceBlock, recentReplies);
      const check = {
        ok: sc.verdict === "pass",
        issue: sc.issues.length ? sc.issues.join("; ") : null,
      };
      console.log(
        `[pipeline] review=${review.id} Stage 3 self-check: after verdict=${sc.verdict}${
          check.issue ? ` issues="${check.issue}"` : ""
        }`
      );
      if (!check.ok) {
        // Failed self-check downgrades to human approval — never silently drop.
        ledger.recordReview({ reviewId: review.id, action: "draft", draft, processedAt: now });
        await sendNotification({
          kind: "needs_approval",
          reviewId: review.id,
          message: `Auto-post blocked by self-check (${check.issue}); routed for approval.`,
        });
        return { reviewId: review.id, action: "draft", posted: false, deduped: false };
      }

      console.log(`[pipeline] review=${review.id} postReply: before (provider=${provider.name})`);
      const result = await provider.postReply(review.id, draft);
      console.log(
        `[pipeline] review=${review.id} postReply: after ok=${result.ok} status=${result.status ?? "n/a"} deduped=${!!result.deduped}`
      );
      const failed =
        result.status === "failed" || result.status === "failed_waiting_for_retry";

      ledger.recordReply({
        reviewId: review.id,
        postId: result.postId,
        status: (result.status as never) ?? (result.ok ? "pending" : "failed"),
        error: result.error,
        errorDetails: result.errorDetails,
        needsAttention: !result.ok || failed,
        updatedAt: now,
      });
      ledger.recordReview({ reviewId: review.id, action, draft, processedAt: now });

      if (!result.ok || failed) {
        await sendNotification({
          kind: "reply_failed",
          reviewId: review.id,
          message: `Auto-post failed (${result.error ?? result.status}); marked for retry.`,
          detail: result.errorDetails,
        });
        return {
          reviewId: review.id,
          action,
          posted: false,
          deduped: !!result.deduped,
          status: result.status,
          error: result.error,
        };
      }

      if (!result.deduped) {
        await sendNotification({
          kind: "auto_posted",
          reviewId: review.id,
          message: `Auto-posted reply (status: ${result.status ?? "pending"}).`,
        });
      }
      console.log(`[pipeline] review=${review.id} done action=${action} posted=true`);
      return {
        reviewId: review.id,
        action,
        posted: true,
        deduped: !!result.deduped,
        status: result.status,
      };
    }

    // draft / notify: record and alert; the coach acts from the app.
    ledger.recordReview({ reviewId: review.id, action, draft, processedAt: now });
    await sendNotification({
      kind: action === "notify" ? "notify_only" : "needs_approval",
      reviewId: review.id,
      message:
        action === "notify"
          ? "New rating-only review — no reply drafted."
          : "New review drafted and waiting for your approval.",
    });
    console.log(`[pipeline] review=${review.id} done action=${action} posted=false`);
    return { reviewId: review.id, action, posted: false, deduped: false };
  } catch (err) {
    // 6. Any error in the pipeline — log the full message + stack.
    console.error(`[pipeline] review=${review.id} ERROR: ${errToString(err)}`);
    throw err;
  }
}
