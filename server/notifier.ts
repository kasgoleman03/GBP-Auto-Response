/**
 * Notifier seam.
 *
 * The pipeline calls this to alert the coach (e.g. "a new review needs your
 * approval", "an auto-post failed and needs attention"). The default just logs;
 * swap in email/SMS/push by re-implementing `notify` — the pipeline is unchanged.
 */

export type NotificationKind =
  | "needs_approval"
  | "auto_posted"
  | "notify_only"
  | "reply_failed";

export interface Notification {
  kind: NotificationKind;
  reviewId: string;
  message: string;
  detail?: unknown;
}

export async function notify(n: Notification): Promise<void> {
  // Structured log; replace with a real channel in production.
  console.log(`[notifier] ${n.kind} review=${n.reviewId} :: ${n.message}`);
}
