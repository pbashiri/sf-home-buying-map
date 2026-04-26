// Streaming summary endpoint backed by Claude Sonnet 4.6 (production) or
// Haiku 4.5 (live preview during slider drag). Falls back to a deterministic
// stub when ANTHROPIC_API_KEY is absent.
//
// Output: SSE-compatible chunks shaped as:
//   data: {"type":"headline","value":"…"}\n\n
//   data: {"type":"bullet","value":{severity, concern_id, text}}\n\n
//   data: {"type":"outlook","value":"…"}\n\n
//   data: {"type":"verdict","value":"alert"|"watch"|"neutral"|"favor"}\n\n
//   data: [DONE]\n\n

import type { Summary } from "@/types/concern";
import Anthropic from "@anthropic-ai/sdk";
import {
  METHODOLOGY_BLOCK,
  METHODOLOGY_VERSION,
  SYSTEM_PROMPT,
  SYSTEM_VERSION,
  type SummaryRequest,
  userPrompt,
} from "./prompts";

const PROD_MODEL = "claude-sonnet-4-5-20250929";
const FAST_MODEL = "claude-haiku-4-5-20251001";

export type StreamMode = "production" | "fast";

export const PROMPT_CACHE_VERSION = `${SYSTEM_VERSION}+${METHODOLOGY_VERSION}`;

function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// SSE encoder
function sseLine(type: string, value: unknown): string {
  return `data: ${JSON.stringify({ type, value })}\n\n`;
}

function sseDone(): string {
  return "data: [DONE]\n\n";
}

/**
 * Produces a deterministic stub summary based on the concerns array.
 * Used when ANTHROPIC_API_KEY is missing — output schema is identical so the
 * client renders the same way regardless.
 */
export function deterministicSummary(req: SummaryRequest): Summary {
  const cs = req.concerns;
  const alerts = cs.filter((c) => c.severity === "alert");
  const watches = cs.filter((c) => c.severity === "watch");
  const favors = cs.filter((c) => c.severity === "favor");

  const place = req.address.neighborhood ?? "this block";

  let headline: string;
  if (alerts.length > 0) {
    headline = `${place}. ${alerts.length === 1 ? alerts[0]!.title : `${alerts.length} alerts to weigh`}.`;
  } else if (watches.length >= 2) {
    headline = `${place}. ${watches.length} concerns to verify in diligence.`;
  } else if (favors.length >= 2 && watches.length === 0) {
    headline = `${place}. Mostly clean signals at this horizon.`;
  } else {
    headline = `${place}. Mixed signals at the ${req.horizon}-year horizon.`;
  }

  // Pick top 6 by severity, skipping context unless it's all we have.
  const ordered = [...alerts, ...watches, ...favors];
  const pick = (ordered.length ? ordered : cs).slice(0, 6);

  const bullets = pick.map((c) => ({
    severity: c.severity,
    concern_id: c.id,
    text: tighten(c.body, 26),
  }));

  let outlook: string;
  if (alerts.length > 0) {
    outlook = `Over the next ${req.horizon} years, the dominant story is the ${alerts
      .map((a) => a.layer.replace(/_/g, " "))
      .slice(0, 2)
      .join(
        " and ",
      )} signal${alerts.length > 1 ? "s" : ""}. The watches mostly affect comfort and convenience, not safety.`;
  } else if (watches.length > 0) {
    outlook = `Over the next ${req.horizon} years, expect watches around ${watches
      .slice(0, 2)
      .map((w) => w.layer.replace(/_/g, " "))
      .join(" and ")} to play out gradually. Nothing here forces a no.`;
  } else {
    outlook = `Over the next ${req.horizon} years, the picture stays clean. Verify retrofit status and the latest disclosure package, then move with confidence.`;
  }

  const verdict =
    alerts.length > 0 ? "alert" : watches.length >= 2 ? "watch" : favors.length > 0 ? "favor" : "neutral";

  return { headline, bullets, outlook, verdict };
}

function tighten(s: string, maxWords: number): string {
  const words = s.replace(/\s+/g, " ").trim().split(" ");
  if (words.length <= maxWords) return words.join(" ");
  return `${words
    .slice(0, maxWords)
    .join(" ")
    .replace(/[,;:.\s]+$/, "")}…`;
}

/**
 * Streaming runner. Yields SSE chunks. Caller is responsible for flushing them
 * to the HTTP response.
 */
export async function* streamSummary(
  req: SummaryRequest,
  mode: StreamMode = "production",
): AsyncGenerator<string, void, void> {
  if (!isAnthropicConfigured()) {
    const out = deterministicSummary(req);
    yield sseLine("headline", out.headline);
    for (const b of out.bullets) {
      // tiny pause so the client can show streaming-feel even on the fallback
      await new Promise((r) => setTimeout(r, 25));
      yield sseLine("bullet", b);
    }
    yield sseLine("outlook", out.outlook);
    yield sseLine("verdict", out.verdict);
    yield sseDone();
    return;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = mode === "fast" ? FAST_MODEL : PROD_MODEL;

  // cache_control is officially supported but typings in older SDK versions
  // miss it. Cast keeps the code clean and avoids reaching for `any`.
  const stream = await client.messages.stream({
    model,
    max_tokens: 1024,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: METHODOLOGY_BLOCK, cache_control: { type: "ephemeral" } },
    ] as unknown as Anthropic.TextBlockParam[],
    messages: [{ role: "user", content: userPrompt(req) }],
  });

  // We accumulate the full text and parse the JSON when complete. Streaming
  // shape-by-shape requires JSON-streaming which Sonnet doesn't reliably emit
  // mid-token; the practical pattern is "stream the whole JSON, then walk".
  let buf = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      buf += event.delta.text;
    }
  }

  let parsed: Summary;
  try {
    parsed = extractJson(buf);
  } catch {
    parsed = deterministicSummary(req);
  }

  yield sseLine("headline", parsed.headline);
  for (const b of parsed.bullets) {
    yield sseLine("bullet", b);
  }
  yield sseLine("outlook", parsed.outlook);
  yield sseLine("verdict", parsed.verdict);
  yield sseDone();
}

// Robustly extract the first {…} block from possibly-noisy output.
function extractJson(s: string): Summary {
  const start = s.indexOf("{");
  if (start === -1) throw new Error("no json");
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const json = s.slice(start, i + 1);
        return JSON.parse(json) as Summary;
      }
    }
  }
  throw new Error("unbalanced json");
}
