/**
 * Drizzle schema for ReplyPilot (Vercel Postgres / Neon).
 *
 * Tables mirror the domain model in `src/lib/types.ts` plus server-side
 * persistence for the processed-review ledger, OAuth tokens, and config blobs.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── reviews ────────────────────────────────────────────────────────────────

export const reviews = pgTable(
  "reviews",
  {
    /** External review id from the provider (e.g. Google native path). */
    id: text("id").primaryKey(),
    reviewerName: text("reviewer_name").notNull(),
    reviewerAvatarUrl: text("reviewer_avatar_url"),
    rating: integer("rating").notNull(),
    text: text("text").notNull().default(""),
    hasText: boolean("has_text").notNull().default(false),
    wordCount: integer("word_count").notNull().default(0),
    /** When the customer left the review on Google. */
    reviewDate: timestamp("review_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("needs_review"),
    /** Provider metadata (Postproxy placement, permalink, etc.). */
    provider: text("provider"),
    placementId: text("placement_id"),
    providerId: text("provider_id"),
    permalink: text("permalink"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("reviews_status_idx").on(t.status),
    index("reviews_review_date_idx").on(t.reviewDate),
  ]
);

// ── drafts ─────────────────────────────────────────────────────────────────

export const drafts = pgTable("drafts", {
  /** One draft row per review. */
  reviewId: text("review_id")
    .primaryKey()
    .references(() => reviews.id, { onDelete: "cascade" }),
  text: text("text").notNull().default(""),
  status: text("status").notNull().default("ready"),
  editable: boolean("editable").notNull().default(true),
  generatedBy: text("generated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── rules ──────────────────────────────────────────────────────────────────

export const rules = pgTable(
  "rules",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** Serialized RuleCondition — { minStars, maxStars, minWords, maxWords, starOnly }. */
    condition: jsonb("condition").notNull(),
    action: text("action").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    locked: boolean("locked").notNull().default(false),
    catchAll: boolean("catch_all").notNull().default(false),
    /** Lower numbers evaluate first; catch-all rules should have the highest value. */
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rules_sort_order_idx").on(t.sortOrder)]
);

// ── activity ───────────────────────────────────────────────────────────────

export const activity = pgTable(
  "activity",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    summary: text("summary").notNull(),
    detail: text("detail"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    reviewId: text("review_id").references(() => reviews.id, {
      onDelete: "set null",
    }),
    actor: text("actor").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("activity_occurred_at_idx").on(t.occurredAt),
    index("activity_review_id_idx").on(t.reviewId),
  ]
);

// ── processed_ledger ───────────────────────────────────────────────────────
// Dedup authority: tracks processed reviews, async reply state, and webhook
// delivery ids so we never post twice or re-process the same event.

export const processedLedger = pgTable(
  "processed_ledger",
  {
    id: text("id").primaryKey(),
    /** External review id — set for review/reply entries. */
    reviewId: text("review_id"),
    /** Postproxy / webhook delivery id — set for delivery dedup entries. */
    deliveryId: text("delivery_id"),
    entryType: text("entry_type").notNull(), // "review" | "reply" | "delivery"
    /** Pipeline action when entryType = "review". */
    action: text("action"),
    /** Draft text snapshot when entryType = "review". */
    draft: text("draft"),
    /** Provider reply record id when entryType = "reply". */
    postId: text("post_id"),
    /** Async reply lifecycle: pending | published | failed | failed_waiting_for_retry */
    replyStatus: text("reply_status"),
    error: text("error"),
    errorDetails: jsonb("error_details"),
    needsAttention: boolean("needs_attention").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("processed_ledger_review_entry_uq").on(t.reviewId, t.entryType),
    uniqueIndex("processed_ledger_delivery_id_uq").on(t.deliveryId),
    index("processed_ledger_entry_type_idx").on(t.entryType),
  ]
);

// ── tokens ─────────────────────────────────────────────────────────────────
// OAuth / API token storage (Postproxy, Google refresh tokens, etc.).

export const tokens = pgTable(
  "tokens",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    tokenType: text("token_type").notNull().default("oauth"),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tokens_provider_idx").on(t.provider),
    uniqueIndex("tokens_provider_type_uq").on(t.provider, t.tokenType),
  ]
);

// ── config ─────────────────────────────────────────────────────────────────
// Key-value store for voice settings, connection state, feature flags, etc.

export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
