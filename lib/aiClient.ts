import type { AiMode } from "./aiMode";
import { mockAiClient } from "./mockAiClient";

// The seam mock mode replaces (D9): only the provider call. Everything the
// route does with the reply (parsing, and later the Zod check, error mapping
// and rate limit) runs the same in mock and live.
export type AiRequest = {
  excerpt: string;
};

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AiReply = {
  text: string;
  stopReason: string;
  usage: AiUsage;
};

export type AiClient = (request: AiRequest) => Promise<AiReply>;

export function getAiClient(mode: AiMode): AiClient {
  if (mode === "mock") {
    return mockAiClient;
  }
  // The live Anthropic client arrives in #5.
  throw new Error("Live AI client is not built yet (issue #5).");
}
