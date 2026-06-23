/**
 * Runtime configuration, sourced from env vars with safe defaults.
 *
 * Nothing real is required to run the app — the mock API needs no keys. Any
 * client-exposed value must use the `NEXT_PUBLIC_` prefix so Next.js inlines it
 * for the browser bundle. Never hardcode hostnames/URLs in components.
 */
export const config = {
  /** Product name shown in the nav/brand. Override with NEXT_PUBLIC_APP_NAME. */
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "ReplyPilot",
  /**
   * Base URL for a future real backend. Unused by the mock API; left blank so
   * there are no hardcoded localhost URLs. Set NEXT_PUBLIC_API_BASE_URL when
   * wiring a real API.
   */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
};
