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

/** Rich email content for approval notifications (review, draft, action links). */
export interface NotificationEmail {
  reviewerName?: string;
  rating?: number;
  reviewText?: string;
  draft?: string;
  /** Labeled action buttons, e.g. "Approve & Post", "Redo". */
  actions?: { label: string; url: string }[];
  /** Deep link to open the review in the app. */
  openInAppUrl?: string;
}

export interface Notification {
  kind: NotificationKind;
  reviewId: string;
  message: string;
  detail?: unknown;
  /** When present, the email is rendered with the full review + draft + links. */
  email?: NotificationEmail;
}

/**
 * Sender address. Using Resend's shared sandbox domain for now so we can test
 * without a verified domain — swap to a verified domain address later.
 */
const FROM_ADDRESS = "onboarding@resend.dev";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Render the HTML + plain-text bodies for a rich approval email. */
function renderEmail(n: Notification): { html: string; text: string } {
  const e = n.email!;
  const stars = e.rating ? "★".repeat(e.rating) + "☆".repeat(5 - e.rating) : "";
  const reviewer = e.reviewerName ?? "A customer";

  const buttons = (e.actions ?? [])
    .map(
      (a) =>
        `<a href="${a.url}" style="display:inline-block;padding:10px 18px;margin:0 8px 8px 0;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px">${esc(
          a.label
        )}</a>`
    )
    .join("");
  const openInApp = e.openInAppUrl
    ? `<p style="margin:8px 0 0"><a href="${e.openInAppUrl}" style="color:#2563eb;font-size:14px">Open in app →</a></p>`
    : "";

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
    <h2 style="margin:0 0 4px">${esc(n.message)}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px">${esc(reviewer)} ${stars}</p>
    ${
      e.reviewText
        ? `<div style="margin:0 0 16px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;margin-bottom:4px">Review</div><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;font-size:15px;white-space:pre-wrap">${esc(
            e.reviewText
          )}</div></div>`
        : ""
    }
    ${
      e.draft
        ? `<div style="margin:0 0 20px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;margin-bottom:4px">AI draft reply</div><div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;font-size:15px;white-space:pre-wrap">${esc(
            e.draft
          )}</div></div>`
        : ""
    }
    <div>${buttons}</div>
    ${openInApp}
  </div>`;

  const textParts = [n.message, `${reviewer} ${stars}`.trim()];
  if (e.reviewText) textParts.push(`\nReview:\n${e.reviewText}`);
  if (e.draft) textParts.push(`\nAI draft reply:\n${e.draft}`);
  if (e.actions?.length) {
    textParts.push(
      "\n" + e.actions.map((a) => `${a.label}: ${a.url}`).join("\n")
    );
  }
  if (e.openInAppUrl) textParts.push(`\nOpen in app: ${e.openInAppUrl}`);

  return { html, text: textParts.join("\n") };
}

export async function notify(n: Notification): Promise<void> {
  // Structured log; always on.
  console.log(`[notifier] ${n.kind} review=${n.reviewId} :: ${n.message}`);

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL;

  // No email channel configured — log-only (keeps local/mock runs dependency-free).
  if (!apiKey || !to) return;

  // Rich approval emails get HTML + action links; everything else is plain text.
  const payload: Record<string, unknown> = {
    from: FROM_ADDRESS,
    to,
    subject: `[ReplyPilot] ${n.kind} — review ${n.reviewId}`,
  };
  if (n.email) {
    const { html, text } = renderEmail(n);
    payload.html = html;
    payload.text = text;
  } else {
    payload.text =
      n.detail !== undefined
        ? `${n.message}\n\n${
            typeof n.detail === "string"
              ? n.detail
              : JSON.stringify(n.detail, null, 2)
          }`
        : n.message;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
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
