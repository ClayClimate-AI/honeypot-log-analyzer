import Anthropic from "@anthropic-ai/sdk";
import type { AiClient } from "./aiClient";

// D4: Claude Haiku 5.5. Effort low because Haiku 5.5 thinks by default and
// thinking tokens bill as output.
export const MODEL = "claude-haiku-5-5";

// D7: the SDK timeout is in milliseconds. 0 retries so a slow call fails fast
// at 8 s instead of up to 3 × 8 s, well under Netlify's function time limit.
const TIMEOUT_MS = 8_000;
const MAX_RETRIES = 0;

// Room for low-effort thinking plus a 600-character summary; also caps the
// output side of the cost.
const MAX_TOKENS = 2_048;

let client: Anthropic | null = null;

// Created on first live call, so mock mode never needs a key. The key comes
// only from the server env and is never logged or sent to the browser.
function getClient(): Anthropic {
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
  return client;
}

export const liveAiClient: AiClient = async ({ system, userMessage }) => {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");

  return {
    text,
    // The output guard treats "refusal" as bad output (D4, D5).
    stopReason: response.stop_reason ?? "unknown",
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
};
