/**
 * Postproxy webhook signature verification.
 *
 * Verified against Postproxy's live docs (https://postproxy.dev/reference/webhooks/):
 *   Header:  X-Postproxy-Signature: t=<unix>,v1=<hmac_sha256_hex>
 *   Signed payload: `${t}.${rawBody}` (rawBody = the exact raw JSON request body)
 *   Algorithm: HMAC-SHA256, hex digest, compared in constant time.
 *
 * Implemented with Web Crypto (`crypto.subtle`) so it runs on the Edge runtime
 * (clean raw body via `Request.text()`) as well as Node 18+.
 */

export interface SignatureCheck {
  valid: boolean;
  reason?: string;
}

function parseHeader(header: string): { t?: string; v1?: string } {
  const out: Record<string, string> = {};
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return { t: out.t, v1: out.v1 };
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Constant-time comparison of two equal-length hex strings. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPostproxySignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds: number;
}): Promise<SignatureCheck> {
  const { rawBody, signatureHeader, secret, toleranceSeconds } = params;
  if (!secret) return { valid: false, reason: "no_secret_configured" };
  if (!signatureHeader) return { valid: false, reason: "missing_signature" };

  const { t, v1 } = parseHeader(signatureHeader);
  if (!t || !v1) return { valid: false, reason: "malformed_signature" };

  // Replay protection: reject stale timestamps.
  const ts = Number(t);
  if (!Number.isFinite(ts)) return { valid: false, reason: "bad_timestamp" };
  const skew = Math.abs(Date.now() / 1000 - ts);
  if (skew > toleranceSeconds) return { valid: false, reason: "timestamp_out_of_tolerance" };

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${rawBody}`));
  const computed = toHex(sig);

  return timingSafeEqual(computed, v1)
    ? { valid: true }
    : { valid: false, reason: "signature_mismatch" };
}
