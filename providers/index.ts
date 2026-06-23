import type { ReviewProvider } from "./types";
import { MockProvider } from "./mock";
import { PostproxyProvider } from "./postproxy";
import { serverConfig } from "../server/config";

let cached: ReviewProvider | undefined;

/**
 * Selects the active provider from REVIEW_PROVIDER (default "mock").
 *
 * - "mock"      → MockProvider (no credentials required; keeps the happy path).
 * - "postproxy" → PostproxyProvider (validates its env lazily, only when used).
 *
 * Cached per runtime instance. Unknown values fall back to mock with a warning
 * so a typo can never take the system down.
 */
export function getProvider(): ReviewProvider {
  if (cached) return cached;
  switch (serverConfig.reviewProvider) {
    case "postproxy":
      cached = new PostproxyProvider();
      break;
    case "mock":
      cached = new MockProvider();
      break;
    default:
      console.warn(
        `[providers] Unknown REVIEW_PROVIDER="${serverConfig.reviewProvider}", falling back to mock`
      );
      cached = new MockProvider();
  }
  return cached;
}

export type { ReviewProvider };
