import type { AiMode } from "./aiMode";
import { liveAiClient } from "./liveAiClient";
import { mockAiClient } from "./mockAiClient";

// The seam mock mode replaces (D9): only the provider call. Everything the
// route does with the reply (parsing, and later the Zod check, error mapping
// and rate limit) runs the same in mock and live. The route builds the full
// request, so the mock records exactly what live would send.
export type AiRequest = {
  system: string;
  userMessage: string;
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
  return liveAiClient;
}
