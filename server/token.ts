/**
 * Signed magic-link tokens for email actions (Approve & Post / Redo).
 *
 * A token is `base64url(payload).base64url(hmacSHA256(payload))` where payload is
 * `{ rid, exp }` — scoped to a single review id and expiring after 48h. Signed
 * with TOKEN_SIGNING_SECRET. Uses Web Crypto (available on the Node.js runtime).
 */

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

interface TokenPayload {
  rid: string;
  exp: number; // epoch ms
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function secret(): string {
  const s = process.env.TOKEN_SIGNING_SECRET;
  if (!s) throw new Error("TOKEN_SIGNING_SECRET is not set");
  return s;
}

async function hmac(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return new Uint8Array(sig);
}

/** Constant-time comparison of two byte arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Sign a 48h magic-link token scoped to the given review id. */
export async function signReviewToken(reviewId: string): Promise<string> {
  const payload: TokenPayload = { rid: reviewId, exp: Date.now() + TOKEN_TTL_MS };
  const payloadB64 = b64urlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const sigB64 = b64urlEncode(await hmac(payloadB64));
  return `${payloadB64}.${sigB64}`;
}

export interface TokenVerification {
  valid: boolean;
  reason?: "malformed" | "bad_signature" | "expired" | "wrong_review";
}

/** Verify a token: signature, expiry, and that it's scoped to `reviewId`. */
export async function verifyReviewToken(
  token: string | null,
  reviewId: string
): Promise<TokenVerification> {
  if (!token || !token.includes(".")) return { valid: false, reason: "malformed" };
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return { valid: false, reason: "malformed" };

  const expected = await hmac(payloadB64);
  let provided: Uint8Array;
  try {
    provided = b64urlDecode(sigB64);
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (!timingSafeEqual(expected, provided)) {
    return { valid: false, reason: "bad_signature" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payloadB64))
    ) as TokenPayload;
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
    return { valid: false, reason: "expired" };
  }
  if (payload.rid !== reviewId) {
    return { valid: false, reason: "wrong_review" };
  }
  return { valid: true };
}
