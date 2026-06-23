/**
 * Server-only runtime configuration.
 *
 * Every value is read from `process.env` (NEVER the `VITE_`-prefixed client
 * vars) so secrets are never bundled into the front-end. Defaults are chosen so
 * that with REVIEW_PROVIDER=mock the app runs with NO Postproxy credentials.
 */

export type ProviderName = "mock" | "postproxy";
export type IngestMode = "poll" | "webhook" | "both";

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function int(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const serverConfig = {
  /** Which provider backs ingestion + replies. Default "mock" (no creds). */
  reviewProvider: (str("REVIEW_PROVIDER", "mock") as ProviderName) ?? "mock",

  /** How reviews arrive. Poll is always available as a safety net. */
  ingestMode: (str("INGEST_MODE", "poll") as IngestMode) ?? "poll",

  /** Optional shared secret Vercel Cron sends as `Authorization: Bearer`. */
  cronSecret: str("CRON_SECRET"),

  postproxy: {
    /** No hardcoded host in code — overridable, defaults to the public API. */
    baseUrl: str("POSTPROXY_API_BASE_URL", "https://api.postproxy.dev"),
    apiKey: str("POSTPROXY_API_KEY"),
    profileId: str("POSTPROXY_PROFILE_ID"),
    /** Location scope: only this placement is ever processed. */
    placementId: str("POSTPROXY_PLACEMENT_ID"),
    webhookSecret: str("POSTPROXY_WEBHOOK_SECRET"),
    /** Reject webhook signatures older than this (replay protection). */
    webhookToleranceSeconds: int("POSTPROXY_WEBHOOK_TOLERANCE_SECONDS", 300),
    /** Safety cap on pages fetched per poll run. */
    maxPollPages: int("POSTPROXY_MAX_POLL_PAGES", 5),
    perPage: int("POSTPROXY_PER_PAGE", 50),
  },
};

/** Throws a clear error if Postproxy is selected without required creds. */
export function assertPostproxyConfigured(opts: { webhook?: boolean } = {}): void {
  const p = serverConfig.postproxy;
  const missing: string[] = [];
  if (!p.apiKey) missing.push("POSTPROXY_API_KEY");
  if (!p.profileId) missing.push("POSTPROXY_PROFILE_ID");
  if (!p.placementId) missing.push("POSTPROXY_PLACEMENT_ID");
  if (opts.webhook && !p.webhookSecret) missing.push("POSTPROXY_WEBHOOK_SECRET");
  if (missing.length > 0) {
    throw new Error(
      `Postproxy provider selected but missing env: ${missing.join(", ")}`
    );
  }
}
