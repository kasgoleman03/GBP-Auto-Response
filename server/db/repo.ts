/**
 * Database repository: the single place that reads/writes the domain tables and
 * maps DB rows to the front-end JSON shapes (lib/types). API routes stay thin by
 * delegating here. Requires POSTGRES_URL (getDb throws otherwise).
 */
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import {
  activity as activityT,
  config as configT,
  drafts as draftsT,
  reviews as reviewsT,
  rules as rulesT,
} from "./schema";
import { DEFAULT_VOICE } from "../voice";
import { getProvider } from "../../providers";
import type { Review as ServerReview } from "../types";
import type {
  ActivityEntry,
  ActivityType,
  Connection,
  Draft,
  DraftStatus,
  InboxStats,
  Rating,
  Review,
  ReviewStatus,
  Rule,
  RuleAction,
  RuleCondition,
  VoiceConfig,
} from "../../lib/types";
import type { ReviewFilter } from "../../lib/api";

const CONNECTION_KEY = "connection";
const VOICE_KEY = "voice";
const CATCH_ALL_SORT = 1000;

function rid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function iso(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString();
  return typeof d === "string" ? d : d.toISOString();
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_RULES: Rule[] = [
  {
    id: "rule_negative",
    name: "Negative reviews → draft for approval",
    condition: { minStars: 1, maxStars: 2, minWords: null, maxWords: null, starOnly: false },
    action: "draft",
    enabled: true,
    locked: true,
    catchAll: false,
  },
  {
    id: "rule_catch_all",
    name: "Everything else",
    condition: { minStars: 1, maxStars: 5, minWords: null, maxWords: null, starOnly: false },
    action: "draft",
    enabled: true,
    locked: false,
    catchAll: true,
  },
];

/**
 * On first DB access, insert the default rule set and default voice config if
 * those tables/rows are empty. Idempotent.
 */
export async function ensureDefaults(): Promise<void> {
  const db = getDb();

  const existingRules = await db.select({ id: rulesT.id }).from(rulesT);
  if (existingRules.length === 0) {
    await db.insert(rulesT).values(
      DEFAULT_RULES.map((r) => ({
        id: r.id,
        name: r.name,
        condition: r.condition,
        action: r.action,
        enabled: r.enabled,
        locked: !!r.locked,
        catchAll: !!r.catchAll,
        sortOrder: r.catchAll ? CATCH_ALL_SORT : 0,
      }))
    );
    console.log("[repo] seeded default rules");
  }

  const voiceRow = await db
    .select()
    .from(configT)
    .where(eq(configT.key, VOICE_KEY))
    .limit(1);
  if (voiceRow.length === 0) {
    await db.insert(configT).values({ key: VOICE_KEY, value: DEFAULT_VOICE });
    console.log("[repo] seeded default voice config");
  }
}

// ── Mappers ─────────────────────────────────────────────────────────────────

type ReviewRow = typeof reviewsT.$inferSelect;
type DraftRow = typeof draftsT.$inferSelect;
type RuleRow = typeof rulesT.$inferSelect;
type ActivityRow = typeof activityT.$inferSelect;

function toReview(r: ReviewRow): Review {
  return {
    id: r.id,
    reviewerName: r.reviewerName,
    reviewerAvatarUrl: r.reviewerAvatarUrl ?? undefined,
    rating: r.rating as Rating,
    text: r.text,
    hasText: r.hasText,
    wordCount: r.wordCount,
    date: iso(r.reviewDate),
    status: r.status as ReviewStatus,
  };
}

function toServerReview(r: ReviewRow): ServerReview {
  return {
    id: r.id,
    reviewerName: r.reviewerName,
    reviewerAvatarUrl: r.reviewerAvatarUrl ?? undefined,
    rating: r.rating as Rating,
    text: r.text,
    hasText: r.hasText,
    wordCount: r.wordCount,
    date: iso(r.reviewDate),
    status: r.status as ReviewStatus,
    meta: {
      provider: r.provider ?? "unknown",
      placementId: r.placementId ?? undefined,
      providerId: r.providerId ?? undefined,
      permalink: r.permalink ?? undefined,
    },
  };
}

function toDraft(d: DraftRow): Draft {
  return {
    reviewId: d.reviewId,
    text: d.text,
    status: d.status as DraftStatus,
    editable: d.editable,
    generatedBy: d.generatedBy ?? undefined,
    updatedAt: d.updatedAt ? iso(d.updatedAt) : undefined,
  };
}

function toRule(r: RuleRow): Rule {
  return {
    id: r.id,
    name: r.name,
    condition: r.condition as RuleCondition,
    action: r.action as RuleAction,
    enabled: r.enabled,
    locked: r.locked,
    catchAll: r.catchAll,
  };
}

function toActivity(a: ActivityRow): ActivityEntry {
  return {
    id: a.id,
    type: a.type as ActivityType,
    summary: a.summary,
    detail: a.detail ?? undefined,
    date: iso(a.occurredAt),
    reviewId: a.reviewId ?? undefined,
    actor: a.actor as "you" | "system",
  };
}

// ── Activity ────────────────────────────────────────────────────────────────

export async function logActivity(entry: {
  type: ActivityType;
  summary: string;
  detail?: string;
  reviewId?: string;
  actor: "you" | "system";
  occurredAt?: string;
}): Promise<void> {
  await getDb()
    .insert(activityT)
    .values({
      id: rid("act"),
      type: entry.type,
      summary: entry.summary,
      detail: entry.detail,
      reviewId: entry.reviewId,
      actor: entry.actor,
      occurredAt: entry.occurredAt ? new Date(entry.occurredAt) : new Date(),
    });
}

export async function listActivity(): Promise<ActivityEntry[]> {
  const rows = await getDb()
    .select()
    .from(activityT)
    .orderBy(desc(activityT.occurredAt));
  return rows.map(toActivity);
}

// ── Connection ──────────────────────────────────────────────────────────────

export async function getConnection(): Promise<Connection> {
  const rows = await getDb()
    .select()
    .from(configT)
    .where(eq(configT.key, CONNECTION_KEY))
    .limit(1);
  const value = rows[0]?.value as Connection | undefined;
  return value ?? { status: "disconnected" };
}

async function putConfig(key: string, value: unknown): Promise<void> {
  await getDb()
    .insert(configT)
    .values({ key, value })
    .onConflictDoUpdate({
      target: configT.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function connectGoogle(input: {
  businessName: string;
  locationAddress: string;
  googleAccountEmail: string;
}): Promise<Connection> {
  const reviewCount = (await getDb().select({ id: reviewsT.id }).from(reviewsT))
    .length;
  const connection: Connection = {
    status: "connected",
    businessName: input.businessName,
    locationAddress: input.locationAddress,
    googleAccountEmail: input.googleAccountEmail,
    connectedAt: new Date().toISOString(),
    importedReviewCount: reviewCount,
  };
  await putConfig(CONNECTION_KEY, connection);

  // Keep voice business name in sync with the connected profile.
  const voice = await getVoiceConfig();
  await putConfig(VOICE_KEY, { ...voice, businessName: input.businessName });

  await logActivity({
    type: "connected",
    summary: `Connected ${input.businessName} and imported ${reviewCount} reviews`,
    actor: "you",
  });
  return connection;
}

export async function disconnect(): Promise<Connection> {
  const connection: Connection = { status: "disconnected" };
  await putConfig(CONNECTION_KEY, connection);
  return connection;
}

// ── Inbox / reviews ─────────────────────────────────────────────────────────

export async function getInboxStats(): Promise<InboxStats> {
  const rows = await getDb()
    .select({ rating: reviewsT.rating, status: reviewsT.status })
    .from(reviewsT);
  const totalReviews = rows.length;
  const needsReview = rows.filter((r) => r.status === "needs_review").length;
  const autoPostedThisWeek = rows.filter((r) => r.status === "auto_posted").length;
  const withoutReply = rows.filter(
    (r) => r.status === "needs_review" || r.status === "notify_only"
  ).length;
  const averageRating =
    totalReviews === 0
      ? 0
      : rows.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
  return {
    needsReview,
    autoPostedThisWeek,
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews,
    withoutReply,
    lastSyncedAt: new Date().toISOString(),
  };
}

export async function listReviews(filter?: ReviewFilter): Promise<Review[]> {
  const rows = await getDb()
    .select()
    .from(reviewsT)
    .orderBy(desc(reviewsT.reviewDate));
  let result = rows.map(toReview);
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
  return result;
}

async function getReviewRow(reviewId: string): Promise<ReviewRow | undefined> {
  const rows = await getDb()
    .select()
    .from(reviewsT)
    .where(eq(reviewsT.id, reviewId))
    .limit(1);
  return rows[0];
}

export async function getReview(reviewId: string): Promise<Review | undefined> {
  const row = await getReviewRow(reviewId);
  return row ? toReview(row) : undefined;
}

export async function getServerReview(
  reviewId: string
): Promise<ServerReview | undefined> {
  const row = await getReviewRow(reviewId);
  return row ? toServerReview(row) : undefined;
}

// ── Drafts ──────────────────────────────────────────────────────────────────

export async function getDraft(reviewId: string): Promise<Draft | undefined> {
  const rows = await getDb()
    .select()
    .from(draftsT)
    .where(eq(draftsT.reviewId, reviewId))
    .limit(1);
  return rows[0] ? toDraft(rows[0]) : undefined;
}

export async function upsertDraft(input: {
  reviewId: string;
  text: string;
  status: DraftStatus;
  editable: boolean;
  generatedBy?: string;
}): Promise<Draft> {
  const set = {
    text: input.text,
    status: input.status,
    editable: input.editable,
    generatedBy: input.generatedBy,
    updatedAt: new Date(),
  };
  const rows = await getDb()
    .insert(draftsT)
    .values({ reviewId: input.reviewId, ...set })
    .onConflictDoUpdate({ target: draftsT.reviewId, set })
    .returning();
  return toDraft(rows[0]);
}

export async function saveDraft(reviewId: string, text: string): Promise<Draft> {
  return upsertDraft({ reviewId, text, status: "edited", editable: true });
}

async function setReviewStatus(
  reviewId: string,
  status: ReviewStatus
): Promise<Review> {
  const rows = await getDb()
    .update(reviewsT)
    .set({ status, updatedAt: new Date() })
    .where(eq(reviewsT.id, reviewId))
    .returning();
  if (!rows[0]) throw new Error(`Review ${reviewId} not found`);
  return toReview(rows[0]);
}

export async function approveAndPost(
  reviewId: string,
  text?: string
): Promise<{ review: Review; draft: Draft }> {
  const existing = await getDraft(reviewId);
  const finalText = text ?? existing?.text ?? "";

  // Post through the active provider (mock publishes instantly).
  const result = await getProvider().postReply(reviewId, finalText);
  if (!result.ok) {
    throw new Error(result.error ?? "Failed to post reply");
  }

  const review = await setReviewStatus(reviewId, "posted");
  const draft = await upsertDraft({
    reviewId,
    text: finalText,
    status: "posted",
    editable: false,
  });
  await logActivity({
    type: "approved",
    summary: `Approved a reply to ${review.reviewerName} (${review.rating}★)`,
    detail: finalText,
    reviewId,
    actor: "you",
  });
  return { review, draft };
}

export async function postOwnReply(
  reviewId: string,
  text: string
): Promise<{ review: Review; draft: Draft }> {
  const result = await getProvider().postReply(reviewId, text);
  if (!result.ok) throw new Error(result.error ?? "Failed to post reply");

  const review = await setReviewStatus(reviewId, "posted");
  const draft = await upsertDraft({
    reviewId,
    text,
    status: "posted",
    editable: false,
  });
  await logActivity({
    type: "edited_and_posted",
    summary: `Wrote and posted a reply to ${review.reviewerName} (${review.rating}★)`,
    detail: text,
    reviewId,
    actor: "you",
  });
  return { review, draft };
}

export async function skipReview(reviewId: string): Promise<Review> {
  const review = await setReviewStatus(reviewId, "skipped");
  await logActivity({
    type: "skipped",
    summary: `Skipped a reply to ${review.reviewerName} (${review.rating}★)`,
    reviewId,
    actor: "you",
  });
  return review;
}

// ── Rules ───────────────────────────────────────────────────────────────────

function sortRules(rules: Rule[]): Rule[] {
  return [...rules].sort((a, b) => (a.catchAll ? 1 : 0) - (b.catchAll ? 1 : 0));
}

export async function listRules(): Promise<Rule[]> {
  await ensureDefaults();
  const rows = await getDb().select().from(rulesT).orderBy(asc(rulesT.sortOrder));
  return sortRules(rows.map(toRule));
}

export async function saveRule(rule: Rule): Promise<Rule> {
  const db = getDb();
  const existing = await db
    .select({ id: rulesT.id, sortOrder: rulesT.sortOrder })
    .from(rulesT);
  const found = existing.find((r) => r.id === rule.id);
  const maxNonCatch = existing.reduce(
    (m, r) => (r.sortOrder < CATCH_ALL_SORT ? Math.max(m, r.sortOrder) : m),
    -1
  );
  const sortOrder = rule.catchAll
    ? CATCH_ALL_SORT
    : found?.sortOrder ?? maxNonCatch + 1;

  const values = {
    id: rule.id,
    name: rule.name,
    condition: rule.condition,
    action: rule.action,
    enabled: rule.enabled,
    locked: !!rule.locked,
    catchAll: !!rule.catchAll,
    sortOrder,
    updatedAt: new Date(),
  };
  await db
    .insert(rulesT)
    .values(values)
    .onConflictDoUpdate({ target: rulesT.id, set: values });

  await logActivity({
    type: "rule_changed",
    summary: `${found ? "Updated" : "Created"} the rule "${rule.name}"`,
    actor: "you",
  });
  return rule;
}

export async function deleteRule(ruleId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(rulesT)
    .where(eq(rulesT.id, ruleId))
    .limit(1);
  const rule = rows[0];
  if (!rule || rule.locked || rule.catchAll) return; // never delete protected rules
  await db.delete(rulesT).where(eq(rulesT.id, ruleId));
  await logActivity({
    type: "rule_changed",
    summary: `Deleted the rule "${rule.name}"`,
    actor: "you",
  });
}

export async function reorderRules(orderedIds: string[]): Promise<Rule[]> {
  const db = getDb();
  const rows = await db.select().from(rulesT);
  for (const row of rows) {
    const idx = orderedIds.indexOf(row.id);
    const sortOrder = row.catchAll
      ? CATCH_ALL_SORT
      : idx === -1
        ? row.sortOrder
        : idx;
    await db
      .update(rulesT)
      .set({ sortOrder, updatedAt: new Date() })
      .where(eq(rulesT.id, row.id));
  }
  return listRules();
}

// ── Voice ───────────────────────────────────────────────────────────────────

export async function getVoiceConfig(): Promise<VoiceConfig> {
  await ensureDefaults();
  const rows = await getDb()
    .select()
    .from(configT)
    .where(eq(configT.key, VOICE_KEY))
    .limit(1);
  const value = rows[0]?.value as Partial<VoiceConfig> | undefined;
  return { ...DEFAULT_VOICE, ...(value ?? {}) };
}

export async function saveVoiceConfig(config: VoiceConfig): Promise<VoiceConfig> {
  await putConfig(VOICE_KEY, config);
  await logActivity({
    type: "voice_changed",
    summary: "Updated brand voice settings",
    actor: "you",
  });
  return config;
}

// ── Pipeline persistence ────────────────────────────────────────────────────

/**
 * Persist a review the pipeline just processed: the review row, its draft, and
 * an activity event. Used by the cron/webhook pipeline and the seed function.
 */
export async function persistProcessedReview(args: {
  review: ServerReview;
  draftText: string;
  reviewStatus: ReviewStatus;
  draftStatus: DraftStatus;
  editable: boolean;
  activity: { type: ActivityType; summary: string; detail?: string };
}): Promise<void> {
  const db = getDb();
  const { review } = args;

  const reviewValues = {
    id: review.id,
    reviewerName: review.reviewerName,
    reviewerAvatarUrl: review.reviewerAvatarUrl,
    rating: review.rating,
    text: review.text,
    hasText: review.hasText,
    wordCount: review.wordCount,
    reviewDate: new Date(review.date),
    status: args.reviewStatus,
    provider: review.meta?.provider,
    placementId: review.meta?.placementId,
    providerId: review.meta?.providerId,
    permalink: review.meta?.permalink,
    updatedAt: new Date(),
  };
  await db
    .insert(reviewsT)
    .values(reviewValues)
    .onConflictDoUpdate({
      target: reviewsT.id,
      set: { status: args.reviewStatus, updatedAt: new Date() },
    });

  const draftSet = {
    text: args.draftText,
    status: args.draftStatus,
    editable: args.editable,
    generatedBy: "ReplyPilot AI",
    updatedAt: new Date(),
  };
  await db
    .insert(draftsT)
    .values({ reviewId: review.id, ...draftSet })
    .onConflictDoUpdate({ target: draftsT.reviewId, set: draftSet });

  await logActivity({
    type: args.activity.type,
    summary: args.activity.summary,
    detail: args.activity.detail,
    reviewId: review.id,
    actor: "system",
  });
}
