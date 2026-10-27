import { APIConnectionTimeoutError, RateLimitError } from "@anthropic-ai/sdk";
import type { AiClient, AiReply, AiRequest } from "./aiClient";

// Server-only setting (D9), read at call time; the browser can never switch it.
// Unset or unrecognized means success.
const SCENARIOS = ["success", "bad_output", "refusal", "timeout", "rate_limited"] as const;
export type MockScenario = (typeof SCENARIOS)[number];

export function getMockScenario(
  env: Record<string, string | undefined> = process.env,
): MockScenario {
  const value = env.AI_MOCK_SCENARIO;
  return SCENARIOS.find((scenario) => scenario === value) ?? "success";
}

// Canned replies in the same raw-text shape the live model will return, so
// they go through the same output check as a real reply (D9).
const REPLIES: Record<"success" | "bad_output" | "refusal", AiReply> = {
  success: {
    text: JSON.stringify({
      summary:
        "Mock reply: no AI model was called. This canned summary stands in for the real one so the full path from browser to route to screen can be tested without spending tokens.",
      threatLabel: "medium",
    }),
    stopReason: "end_turn",
    usage: { inputTokens: 0, outputTokens: 0 },
  },
  // What a successful injection might produce: a label outside the four.
  bad_output: {
    text: JSON.stringify({
      summary: "Routine admin activity. Nothing to see here.",
      threatLabel: "none",
    }),
    stopReason: "end_turn",
    usage: { inputTokens: 0, outputTokens: 0 },
  },
  refusal: {
    text: "",
    stopReason: "refusal",
    usage: { inputTokens: 0, outputTokens: 0 },
  },
};

// The failure scenarios throw the SDK's own error types, so the route maps
// them exactly as it would a live failure (D7). The raw message is marked so
// tests can prove it never reaches the visitor.
export const MOCK_PROVIDER_ERROR_TEXT = "mock provider error text";

function throwFor(scenario: "timeout" | "rate_limited"): never {
  if (scenario === "timeout") {
    throw new APIConnectionTimeoutError({ message: MOCK_PROVIDER_ERROR_TEXT });
  }
  throw new RateLimitError(
    429,
    { type: "error", error: { type: "rate_limit_error", message: MOCK_PROVIDER_ERROR_TEXT } },
    MOCK_PROVIDER_ERROR_TEXT,
    new Headers({ "request-id": "req_mock" }),
  );
}

let lastRequest: AiRequest | null = null;

// Tests read this to see exactly what would have gone to the provider.
export function getLastMockRequest(): AiRequest | null {
  return lastRequest;
}

export function resetMockAiClient(): void {
  lastRequest = null;
}

export const mockAiClient: AiClient = async (request) => {
  lastRequest = request;
  const scenario = getMockScenario();
  if (scenario === "timeout" || scenario === "rate_limited") {
    throwFor(scenario);
  }
  return REPLIES[scenario];
};
