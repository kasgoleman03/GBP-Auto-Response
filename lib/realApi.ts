import type { ReplyPilotApi, ReviewFilter } from "./api";
import type {
  ActivityEntry,
  Connection,
  Draft,
  InboxStats,
  Review,
  Rule,
  VoiceConfig,
} from "./types";

/**
 * Real backend implementation of {@link ReplyPilotApi} — every method is a
 * `fetch()` to a route under `/api`. Used when a database is configured
 * (see lib/dataClient.ts). Reads come from the DB; writes post through it.
 */

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`${init?.method ?? "GET"} ${url} failed: ${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}

/** GET that tolerates 404 by resolving to undefined (for getReview/getDraft). */
async function jsonFetchOptional<T>(url: string): Promise<T | undefined> {
  const res = await fetch(url);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

function buildReviewQuery(filter?: ReviewFilter): string {
  if (!filter) return "";
  const sp = new URLSearchParams();
  if (filter.status) sp.set("status", filter.status);
  if (typeof filter.minRating === "number") sp.set("minRating", String(filter.minRating));
  if (typeof filter.maxRating === "number") sp.set("maxRating", String(filter.maxRating));
  if (typeof filter.hasText === "boolean") sp.set("hasText", String(filter.hasText));
  if (filter.search) sp.set("search", filter.search);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const realApi: ReplyPilotApi = {
  // --- Connection ---
  getConnection: () => jsonFetch<Connection>("/api/connection"),
  connectGoogle: (input) =>
    jsonFetch<Connection>("/api/connection", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  disconnect: () => jsonFetch<Connection>("/api/connection", { method: "DELETE" }),

  // --- Inbox / reviews ---
  getInboxStats: () => jsonFetch<InboxStats>("/api/inbox/stats"),
  listReviews: (filter) =>
    jsonFetch<Review[]>(`/api/reviews${buildReviewQuery(filter)}`),
  getReview: (reviewId) =>
    jsonFetchOptional<Review>(`/api/reviews/${reviewId}`),

  // --- Drafts / approval ---
  getDraft: (reviewId) =>
    jsonFetchOptional<Draft>(`/api/reviews/${reviewId}/draft`),
  regenerateDraft: (reviewId) =>
    jsonFetch<Draft>(`/api/reviews/${reviewId}/redo`, { method: "POST" }),
  approveAndPost: (reviewId, text) =>
    jsonFetch<{ review: Review; draft: Draft }>(
      `/api/reviews/${reviewId}/approve`,
      { method: "POST", body: JSON.stringify({ text }) }
    ),
  postOwnReply: (reviewId, text) =>
    jsonFetch<{ review: Review; draft: Draft }>(
      `/api/reviews/${reviewId}/reply`,
      { method: "POST", body: JSON.stringify({ text }) }
    ),
  saveDraft: (reviewId, text) =>
    jsonFetch<Draft>(`/api/reviews/${reviewId}/draft`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  skipReview: (reviewId) =>
    jsonFetch<Review>(`/api/reviews/${reviewId}/skip`, { method: "POST" }),

  // --- Rules ---
  listRules: () => jsonFetch<Rule[]>("/api/rules"),
  saveRule: (rule) =>
    jsonFetch<Rule>("/api/rules", { method: "POST", body: JSON.stringify(rule) }),
  deleteRule: async (ruleId) => {
    await jsonFetch<{ ok: boolean }>(`/api/rules/${ruleId}`, { method: "DELETE" });
  },
  reorderRules: (orderedIds) =>
    jsonFetch<Rule[]>("/api/rules/reorder", {
      method: "POST",
      body: JSON.stringify({ orderedIds }),
    }),

  // --- Voice ---
  getVoiceConfig: () => jsonFetch<VoiceConfig>("/api/voice"),
  saveVoiceConfig: (config) =>
    jsonFetch<VoiceConfig>("/api/voice", {
      method: "POST",
      body: JSON.stringify(config),
    }),
  previewVoice: async (config, sampleReview) => {
    const { text } = await jsonFetch<{ text: string }>("/api/voice/preview", {
      method: "POST",
      body: JSON.stringify({ config, sampleReview }),
    });
    return text;
  },

  // --- Activity ---
  listActivity: () => jsonFetch<ActivityEntry[]>("/api/activity"),
};
