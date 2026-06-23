/**
 * Voice & Brand config loader for the pipeline.
 *
 * Reads the same logical settings the Voice & Brand screen edits, from the
 * Postgres `config` table at key "voice" (a single JSONB blob). Falls back to
 * sensible placeholder defaults when the row (or the database) is unavailable,
 * so the mock/local path keeps working with no credentials.
 *
 * The `value` shape mirrors the front-end `VoiceConfig` (lib/types.ts) but is
 * defined here independently to keep the server decoupled from the app build.
 */
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { config as configTable } from "./db/schema";

export type VoiceTone =
  | "warm"
  | "professional"
  | "friendly"
  | "playful"
  | "concise";

export type ReplyLength = "short" | "medium" | "long";

export interface VoiceConfig {
  businessName: string;
  voiceDescription: string;
  signOff: string;
  allowEmoji: boolean;
  useFirstName: boolean;
  tone: VoiceTone;
  length: ReplyLength;
  bannedPhrases: string[];
  offerToMakeItRight: boolean;
}

/** The config-table key the Voice & Brand settings are stored under. */
export const VOICE_CONFIG_KEY = "voice";

/** Placeholder fallback used when no DB row exists yet. */
const DEFAULT_VOICE: VoiceConfig = {
  businessName: "[GYM_NAME]",
  voiceDescription:
    "A kickboxing and fitness gym. Warm, energetic, and encouraging — like a coach who knows their members by name.",
  signOff: "— Coach [COACH_NAME]",
  allowEmoji: false,
  useFirstName: true,
  tone: "warm",
  length: "short",
  bannedPhrases: ["valued customer", "we apologize for any inconvenience"],
  offerToMakeItRight: true,
};

/**
 * Load the voice config from the DB `config` table. Never throws: on any error
 * (no POSTGRES_URL, missing row, bad JSON) it logs and returns the defaults.
 */
export async function loadVoiceConfig(): Promise<VoiceConfig> {
  try {
    const rows = await getDb()
      .select()
      .from(configTable)
      .where(eq(configTable.key, VOICE_CONFIG_KEY))
      .limit(1);

    const value = rows[0]?.value;
    if (value && typeof value === "object") {
      // Merge over defaults so partial rows still produce a complete config.
      return { ...DEFAULT_VOICE, ...(value as Partial<VoiceConfig>) };
    }
    console.log(
      `[pipeline] voice config: no "${VOICE_CONFIG_KEY}" row found — using defaults`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[pipeline] voice config: failed to load from DB (${message}) — using defaults`
    );
  }
  return DEFAULT_VOICE;
}

/** Render a voice config into the shared system-prompt voice block. */
export function buildVoiceBlock(v: VoiceConfig): string {
  return [
    "VOICE & BRAND (use this for every reply)",
    `Business name: ${v.businessName}`,
    v.voiceDescription ? `Brand voice: ${v.voiceDescription}` : "",
    `Tone: ${v.tone}.`,
    `Target reply length: ${v.length}.`,
    v.allowEmoji
      ? "Emoji: allowed, but sparingly."
      : "Emoji: do not use any emoji.",
    v.useFirstName
      ? "Names: address the reviewer by first name when it is available."
      : "Names: do not use the reviewer's name.",
    v.signOff
      ? `Sign-off: end the reply with "${v.signOff}".`
      : "Sign-off: do not add a sign-off line.",
    v.offerToMakeItRight
      ? "For unhappy reviewers: warmly invite them to reach out privately so you can make it right — without admitting fault."
      : "",
    v.bannedPhrases.length
      ? `Never use these phrases: ${v.bannedPhrases
          .map((p) => `"${p}"`)
          .join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
