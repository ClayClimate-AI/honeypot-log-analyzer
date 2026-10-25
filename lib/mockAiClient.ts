import type { AiClient, AiReply, AiRequest } from "./aiClient";

// Server-only setting (D9), read at call time; the browser can never switch it.
// Only "success" exists so far; #10 adds bad_output, timeout, rate_limited and
// refusal. Unset or unrecognized means success.
const SCENARIOS = ["success"] as const;
export type MockScenario = (typeof SCENARIOS)[number];

export function getMockScenario(
  env: Record<string, string | undefined> = process.env,
): MockScenario {
  const value = env.AI_MOCK_SCENARIO;
  return SCENARIOS.find((scenario) => scenario === value) ?? "success";
}

// Canned replies in the same raw-text shape the live model will return, so
// they go through the same parsing as a real reply.
const REPLIES: Record<MockScenario, AiReply> = {
  success: {
    text: JSON.stringify({
      summary:
        "Mock reply: no AI model was called. This canned summary stands in for the real one so the full path from browser to route to screen can be tested without spending tokens.",
      threatLabel: "medium",
    }),
    stopReason: "end_turn",
    usage: { inputTokens: 0, outputTokens: 0 },
  },
};

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
  return REPLIES[getMockScenario()];
};
