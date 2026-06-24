import type { ReplyPilotApi } from "./api";
import { mockApi } from "./mockApi";
import { realApi } from "./realApi";

/**
 * Picks the data source at runtime:
 *  - DB present  → real backend (`realApi`, fetches from /api/*).
 *  - DB absent   → in-memory/localStorage mock (`mockApi`) for local UI work.
 *
 * The server owns the single source of truth (POSTGRES_URL); the client learns
 * the mode from `/api/status` and the choice is cached + logged so it's obvious
 * which mode the app is running in.
 */

let implPromise: Promise<ReplyPilotApi> | null = null;

async function resolveImpl(): Promise<ReplyPilotApi> {
  let useDb = false;
  try {
    const res = await fetch("/api/status");
    if (res.ok) {
      const data = (await res.json()) as { db?: boolean };
      useDb = !!data.db;
    }
  } catch {
    useDb = false;
  }
  if (typeof console !== "undefined") {
    console.info(
      useDb
        ? "[ReplyPilot] data mode: DATABASE (POSTGRES_URL present, reading real data from /api)"
        : "[ReplyPilot] data mode: MOCK (no database — using in-memory/localStorage fallback)"
    );
  }
  return useDb ? realApi : mockApi;
}

function getImpl(): Promise<ReplyPilotApi> {
  if (!implPromise) implPromise = resolveImpl();
  return implPromise;
}

/**
 * Facade implementing {@link ReplyPilotApi}. Every call resolves the active
 * implementation first (cached after the initial `/api/status` probe).
 */
export const api: ReplyPilotApi = {
  getConnection: async () => (await getImpl()).getConnection(),
  connectGoogle: async (input) => (await getImpl()).connectGoogle(input),
  disconnect: async () => (await getImpl()).disconnect(),

  getInboxStats: async () => (await getImpl()).getInboxStats(),
  listReviews: async (filter) => (await getImpl()).listReviews(filter),
  getReview: async (reviewId) => (await getImpl()).getReview(reviewId),

  getDraft: async (reviewId) => (await getImpl()).getDraft(reviewId),
  regenerateDraft: async (reviewId) => (await getImpl()).regenerateDraft(reviewId),
  approveAndPost: async (reviewId, text) =>
    (await getImpl()).approveAndPost(reviewId, text),
  postOwnReply: async (reviewId, text) =>
    (await getImpl()).postOwnReply(reviewId, text),
  saveDraft: async (reviewId, text) => (await getImpl()).saveDraft(reviewId, text),
  skipReview: async (reviewId) => (await getImpl()).skipReview(reviewId),

  listRules: async () => (await getImpl()).listRules(),
  saveRule: async (rule) => (await getImpl()).saveRule(rule),
  deleteRule: async (ruleId) => (await getImpl()).deleteRule(ruleId),
  reorderRules: async (orderedIds) => (await getImpl()).reorderRules(orderedIds),

  getVoiceConfig: async () => (await getImpl()).getVoiceConfig(),
  saveVoiceConfig: async (config) => (await getImpl()).saveVoiceConfig(config),
  previewVoice: async (config, sampleReview) =>
    (await getImpl()).previewVoice(config, sampleReview),

  listActivity: async () => (await getImpl()).listActivity(),
};
