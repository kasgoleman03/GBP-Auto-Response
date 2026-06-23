/**
 * Runtime configuration, sourced from Vite env vars with safe defaults.
 *
 * Nothing real is required to run the app — the mock API needs no keys. Any
 * client-exposed value must use the `VITE_` prefix (Vite's equivalent of
 * Next.js's `NEXT_PUBLIC_`). Never hardcode hostnames/URLs in components.
 */
const env = import.meta.env;

export const config = {
  /** Product name shown in the nav/brand. Override with VITE_APP_NAME. */
  appName: (env.VITE_APP_NAME as string | undefined) ?? "ReplyPilot",
  /**
   * Base URL for a future real backend. Unused by the mock API; left blank so
   * there are no hardcoded localhost URLs. Set VITE_API_BASE_URL when wiring a
   * real API.
   */
  apiBaseUrl: (env.VITE_API_BASE_URL as string | undefined) ?? "",
};
