/**
 * Thin Anthropic (Claude) client used by the pipeline stages.
 *
 * Lazily constructed so importing this module never throws when
 * ANTHROPIC_API_KEY is absent (e.g. during build / page-data collection).
 */
import Anthropic from "@anthropic-ai/sdk";

/** Model used for all three pipeline stages. */
export const ANTHROPIC_MODEL = "claude-haiku-4-5";

let client: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client = new Anthropic({ apiKey });
  return client;
}

/** Single-turn completion. Returns the concatenated text content, trimmed. */
export async function callClaude(opts: {
  system: string;
  user: string;
  temperature: number;
  maxTokens?: number;
}): Promise<string> {
  const res = await getAnthropic().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 400,
    temperature: opts.temperature,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  return res.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

/**
 * Parse a JSON object out of Claude's response. Tolerates ```json fences. On
 * failure, logs the full raw response and throws a clear, stage-labeled error.
 */
export function parseClaudeJson<T>(raw: string, stage: string): T {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.error(
      `[pipeline] ${stage}: Claude returned invalid JSON. Raw response:\n${raw}`
    );
    throw new Error(`${stage}: Claude returned invalid JSON`);
  }
}
