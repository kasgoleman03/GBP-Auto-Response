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
import {
  seedActivity,
  seedConnection,
  seedDrafts,
  seedReviews,
  seedRules,
  seedVoiceConfig,
} from "./mockData";

/** Fake network latency so loading states are exercised in the UI. */
function delay<T>(value: T, ms = 380): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function firstNameOf(name: string): string {
  return name.split(/\s+/)[0]?.replace(/[^a-zA-Z'-]/g, "") || name;
}

/* ------------------------------------------------------------------ *
 * Temporary persistence layer (localStorage).
 *
 * This lives entirely inside the mock API so components never touch
 * localStorage directly — swapping in a real backend stays a one-file
 * change. Everything is SSR-safe: we never touch `window` during render,
 * and every access is guarded by `typeof window !== "undefined"`.
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "replypilot:state:v1";

interface PersistedState {
  connection: Connection;
  reviews: Review[];
  drafts: Draft[];
  rules: Rule[];
  voice: VoiceConfig;
  activity: ActivityEntry[];
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadState(): PersistedState | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

function saveState(state: PersistedState): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / serialization errors — falls back to in-memory state */
  }
}

/**
 * In-memory mutable store, mirrored to localStorage after every mutation.
 * A real implementation would replace this whole file; the rest of the app
 * only depends on the `ReplyPilotApi` interface.
 */
class MockReplyPilotApi implements ReplyPilotApi {
  private connection: Connection = clone(seedConnection);
  private reviews: Review[] = clone(seedReviews);
  private drafts: Draft[] = clone(seedDrafts);
  private rules: Rule[] = clone(seedRules);
  private voice: VoiceConfig = clone(seedVoiceConfig);
  private activity: ActivityEntry[] = clone(seedActivity);

  constructor() {
    // Seed from mock data on first load only; after that the stored values win.
    const persisted = loadState();
    if (persisted) {
      this.connection = persisted.connection;
      this.reviews = persisted.reviews;
      this.drafts = persisted.drafts;
      this.rules = persisted.rules;
      this.voice = persisted.voice;
      this.activity = persisted.activity;
    } else {
      this.persist();
    }
  }

  /** Snapshot the current store to localStorage (no-op during SSR). */
  private persist(): void {
    saveState({
      connection: this.connection,
      reviews: this.reviews,
      drafts: this.drafts,
      rules: this.rules,
      voice: this.voice,
      activity: this.activity,
    });
  }

  private log(entry: Omit<ActivityEntry, "id" | "date">): void {
    this.activity.unshift({
      ...entry,
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString(),
    });
  }

  /** Catch-all rules always sort to the bottom so every review is routed. */
  private normalizeRuleOrder(): void {
    this.rules.sort((a, b) => (a.catchAll ? 1 : 0) - (b.catchAll ? 1 : 0));
  }

  // --- Connection ----------------------------------------------------
  async getConnection(): Promise<Connection> {
    return delay(clone(this.connection), 200);
  }

  async connectGoogle(input: {
    businessName: string;
    locationAddress: string;
    googleAccountEmail: string;
  }): Promise<Connection> {
    this.connection = {
      status: "connected",
      businessName: input.businessName,
      locationAddress: input.locationAddress,
      googleAccountEmail: input.googleAccountEmail,
      connectedAt: new Date().toISOString(),
      importedReviewCount: this.reviews.length,
    };
    this.voice.businessName = input.businessName;
    this.log({
      type: "connected",
      summary: `Connected ${input.businessName} and imported ${this.reviews.length} reviews`,
      actor: "you",
    });
    this.persist();
    return delay(clone(this.connection), 1400);
  }

  async disconnect(): Promise<Connection> {
    this.connection = { status: "disconnected" };
    this.persist();
    return delay(clone(this.connection), 300);
  }

  // --- Inbox ---------------------------------------------------------
  async getInboxStats(): Promise<InboxStats> {
    const totalReviews = this.reviews.length;
    const needsReview = this.reviews.filter(
      (r) => r.status === "needs_review"
    ).length;
    const autoPostedThisWeek = this.reviews.filter(
      (r) => r.status === "auto_posted"
    ).length;
    const withoutReply = this.reviews.filter(
      (r) => r.status === "needs_review" || r.status === "notify_only"
    ).length;
    const averageRating =
      totalReviews === 0
        ? 0
        : this.reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
    return delay(
      {
        needsReview,
        autoPostedThisWeek,
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews,
        withoutReply,
        // Mocked "last synced" — a few minutes ago.
        lastSyncedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
      },
      250
    );
  }

  async listReviews(filter?: ReviewFilter): Promise<Review[]> {
    let result = clone(this.reviews);
    if (filter) {
      if (filter.status && filter.status !== "all") {
        result = result.filter((r) => r.status === filter.status);
      }
      if (typeof filter.maxRating === "number") {
        result = result.filter((r) => r.rating <= filter.maxRating!);
      }
      if (typeof filter.minRating === "number") {
        result = result.filter((r) => r.rating >= filter.minRating!);
      }
      if (typeof filter.hasText === "boolean") {
        result = result.filter((r) => r.hasText === filter.hasText);
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        result = result.filter(
          (r) =>
            r.reviewerName.toLowerCase().includes(q) ||
            r.text.toLowerCase().includes(q)
        );
      }
    }
    result.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    return delay(result);
  }

  async getReview(reviewId: string): Promise<Review | undefined> {
    return delay(clone(this.reviews.find((r) => r.id === reviewId)), 200);
  }

  // --- Drafts --------------------------------------------------------
  async getDraft(reviewId: string): Promise<Draft | undefined> {
    return delay(clone(this.drafts.find((d) => d.reviewId === reviewId)), 220);
  }

  /** Compose a plausible AI reply from the review + current voice settings. */
  private compose(review: Review): string {
    const v = this.voice;
    const name = v.useFirstName ? firstNameOf(review.reviewerName) : "";
    const greeting = name ? `${name}, ` : "";
    const emoji = v.allowEmoji ? pick(["🥊", "💪", "🔥", "👊"]) : "";
    const negative = review.rating <= 2;
    const starOnly = !review.hasText;

    let body: string;
    if (negative) {
      body =
        `${greeting}we're sorry your experience missed the mark — that's not ` +
        `the standard we hold ourselves to.`;
      if (v.offerToMakeItRight) {
        body += ` We'd love to make it right; reach out to ${
          this.connection.googleAccountEmail ?? "us"
        } and we'll take care of you.`;
      }
    } else if (starOnly) {
      body = `Thanks for the ${review.rating}-star rating${
        greeting ? `, ${name}` : ""
      }! We appreciate you being part of the crew${emoji ? ` ${emoji}` : ""}.`;
    } else {
      body =
        `${greeting}thank you for the awesome review! ` +
        `We're pumped you're getting after it with us and we'll keep ` +
        `pushing right alongside you${emoji ? ` ${emoji}` : ""}.`;
    }

    if (v.length === "short") {
      body = body.split(". ").slice(0, 1).join(". ");
      if (!body.endsWith(".")) body += ".";
    }

    return v.signOff ? `${body}\n\n${v.signOff}` : body;
  }

  async regenerateDraft(reviewId: string): Promise<Draft> {
    const review = this.reviews.find((r) => r.id === reviewId);
    if (!review) throw new Error(`Review ${reviewId} not found`);
    const text = this.compose(review);
    const existing = this.drafts.find((d) => d.reviewId === reviewId);
    const next: Draft = {
      reviewId,
      text,
      status: "ready",
      editable: true,
      generatedBy: "ReplyPilot AI",
      updatedAt: new Date().toISOString(),
    };
    if (existing) Object.assign(existing, next);
    else this.drafts.push(next);
    this.log({
      type: "regenerated",
      summary: `You regenerated the draft for ${review.reviewerName} (${review.rating}★)`,
      reviewId,
      actor: "you",
    });
    this.persist();
    // Longer delay simulates the model "thinking".
    return delay(clone(next), 1100);
  }

  async saveDraft(reviewId: string, text: string): Promise<Draft> {
    const existing = this.drafts.find((d) => d.reviewId === reviewId);
    if (existing) {
      existing.text = text;
      existing.status = "edited";
      existing.updatedAt = new Date().toISOString();
      this.persist();
      return delay(clone(existing), 120);
    }
    const created: Draft = {
      reviewId,
      text,
      status: "edited",
      editable: true,
      updatedAt: new Date().toISOString(),
    };
    this.drafts.push(created);
    this.persist();
    return delay(clone(created), 120);
  }

  private markPosted(reviewId: string, text: string): {
    review: Review;
    draft: Draft;
  } {
    const review = this.reviews.find((r) => r.id === reviewId);
    if (!review) throw new Error(`Review ${reviewId} not found`);
    review.status = "posted";
    let draft = this.drafts.find((d) => d.reviewId === reviewId);
    if (!draft) {
      draft = { reviewId, text, status: "posted", editable: false };
      this.drafts.push(draft);
    } else {
      draft.text = text;
      draft.status = "posted";
      draft.editable = false;
      draft.updatedAt = new Date().toISOString();
    }
    return { review: clone(review), draft: clone(draft) };
  }

  async approveAndPost(
    reviewId: string,
    text?: string
  ): Promise<{ review: Review; draft: Draft }> {
    const current = this.drafts.find((d) => d.reviewId === reviewId);
    const finalText = text ?? current?.text ?? "";
    const result = this.markPosted(reviewId, finalText);
    this.log({
      type: "approved",
      summary: `You approved a reply to ${result.review.reviewerName} (${result.review.rating}★)`,
      detail: finalText,
      reviewId,
      actor: "you",
    });
    this.persist();
    return delay(result, 650);
  }

  async postOwnReply(
    reviewId: string,
    text: string
  ): Promise<{ review: Review; draft: Draft }> {
    const result = this.markPosted(reviewId, text);
    this.log({
      type: "edited_and_posted",
      summary: `You wrote and posted a reply to ${result.review.reviewerName} (${result.review.rating}★)`,
      detail: text,
      reviewId,
      actor: "you",
    });
    this.persist();
    return delay(result, 650);
  }

  async skipReview(reviewId: string): Promise<Review> {
    const review = this.reviews.find((r) => r.id === reviewId);
    if (!review) throw new Error(`Review ${reviewId} not found`);
    review.status = "skipped";
    this.log({
      type: "skipped",
      summary: `You skipped a reply to ${review.reviewerName} (${review.rating}★)`,
      reviewId,
      actor: "you",
    });
    this.persist();
    return delay(clone(review), 300);
  }

  // --- Rules ---------------------------------------------------------
  async listRules(): Promise<Rule[]> {
    this.normalizeRuleOrder();
    return delay(clone(this.rules), 200);
  }

  async saveRule(rule: Rule): Promise<Rule> {
    const idx = this.rules.findIndex((r) => r.id === rule.id);
    const isNew = idx === -1;
    if (isNew) this.rules.push(clone(rule));
    else this.rules[idx] = clone(rule);
    this.normalizeRuleOrder();
    this.log({
      type: "rule_changed",
      summary: `${isNew ? "You created" : "You updated"} the rule "${rule.name}"`,
      actor: "you",
    });
    this.persist();
    return delay(clone(rule), 300);
  }

  async deleteRule(ruleId: string): Promise<void> {
    const rule = this.rules.find((r) => r.id === ruleId);
    // Locked and catch-all rules can never be deleted.
    this.rules = this.rules.filter(
      (r) => r.id !== ruleId || r.locked || r.catchAll
    );
    if (rule && !rule.locked && !rule.catchAll) {
      this.log({
        type: "rule_changed",
        summary: `You deleted the rule "${rule.name}"`,
        actor: "you",
      });
    }
    this.persist();
    return delay(undefined, 250);
  }

  async reorderRules(orderedIds: string[]): Promise<Rule[]> {
    this.rules.sort(
      (a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)
    );
    this.normalizeRuleOrder();
    this.persist();
    return delay(clone(this.rules), 150);
  }

  // --- Voice ---------------------------------------------------------
  async getVoiceConfig(): Promise<VoiceConfig> {
    return delay(clone(this.voice), 200);
  }

  async saveVoiceConfig(config: VoiceConfig): Promise<VoiceConfig> {
    this.voice = clone(config);
    this.log({
      type: "voice_changed",
      summary: "You updated your brand voice settings",
      actor: "you",
    });
    this.persist();
    return delay(clone(this.voice), 400);
  }

  async previewVoice(config: VoiceConfig, sampleReview: Review): Promise<string> {
    const saved = this.voice;
    this.voice = config;
    const text = this.compose(sampleReview);
    this.voice = saved;
    return delay(text, 800);
  }

  // --- Activity ------------------------------------------------------
  async listActivity(): Promise<ActivityEntry[]> {
    return delay(clone(this.activity), 250);
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * In-memory/localStorage mock. The app no longer imports this directly — it goes
 * through `lib/dataClient.ts`, which falls back to this when no DB is configured.
 */
export const mockApi: ReplyPilotApi = new MockReplyPilotApi();
