/**
 * Notifier seam.
 *
 * The pipeline calls this to alert the coach (e.g. "a new review needs your
 * approval", "an auto-post failed and needs attention"). It always logs, and
 * additionally sends an email via Resend when RESEND_API_KEY and
 * NOTIFICATION_EMAIL are configured.
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

/**
 * Sender address. Using Resend's shared sandbox domain for now so we can test
 * without a verified domain — swap to a verified domain address later.
 */
const FROM_ADDRESS = "onboarding@resend.dev";

export async function notify(n: Notification): Promise<void> {
  // Structured log; always on.
  console.log(`[notifier] ${n.kind} review=${n.reviewId} :: ${n.message}`);

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL;

  // No email channel configured — log-only (keeps local/mock runs dependency-free).
  if (!apiKey || !to) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        subject: `[ReplyPilot] ${n.kind} — review ${n.reviewId}`,
        text:
          n.detail !== undefined
            ? `${n.message}\n\n${
                typeof n.detail === "string"
                  ? n.detail
                  : JSON.stringify(n.detail, null, 2)
              }`
            : n.message,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[notifier] resend send failed: ${res.status} ${body}`.trim()
      );
    }
  } catch (err) {
    // Never let a notification failure break the pipeline.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[notifier] resend send error: ${message}`);
  }
}
