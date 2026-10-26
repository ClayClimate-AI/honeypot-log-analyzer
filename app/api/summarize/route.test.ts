import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLastMockRequest, resetMockAiClient } from "../../../lib/mockAiClient";
import {
  EMPTY_MESSAGE,
  MAX_EXCERPT_CHARS,
  NOT_COWRIE_MESSAGE,
  tooLongMessage,
} from "../../../lib/inputGuard";
import { SYSTEM_PROMPT } from "../../../lib/prompt";
import { POST } from "./route";

const EXCERPT =
  '{"eventid":"cowrie.login.failed","username":"root","password":"123456","src_ip":"203.0.113.42"}';

function summarizeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/summarize", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/summarize (mock mode)", () => {
  beforeEach(() => {
    vi.stubEnv("AI_MODE", "mock");
    vi.stubEnv("AI_MOCK_SCENARIO", "success");
    resetMockAiClient();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the canned summary with zero usage and zero cost", async () => {
    const response = await POST(summarizeRequest({ excerpt: EXCERPT }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      summary: expect.any(String),
      threatLabel: "medium",
      mode: "mock",
      usage: { inputTokens: 0, outputTokens: 0 },
      costUsd: 0,
    });
    expect(body.summary.length).toBeGreaterThan(0);
  });

  it("sends the system prompt and the excerpt wrapped in <log_excerpt> tags", async () => {
    await POST(summarizeRequest({ excerpt: EXCERPT }));

    expect(getLastMockRequest()).toEqual({
      system: SYSTEM_PROMPT,
      userMessage: `<log_excerpt>\n${EXCERPT}\n</log_excerpt>`,
    });
  });

  it("defaults to mock when AI_MODE is unset", async () => {
    vi.stubEnv("AI_MODE", undefined);

    const response = await POST(summarizeRequest({ excerpt: EXCERPT }));

    expect(response.status).toBe(200);
    expect((await response.json()).mode).toBe("mock");
  });

  it("ignores any attempt in the request to switch mode or scenario", async () => {
    const response = await POST(
      summarizeRequest(
        { excerpt: EXCERPT, mode: "live", AI_MODE: "live", scenario: "timeout" },
        { "x-ai-mode": "live", "x-ai-mock-scenario": "timeout" },
      ),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("mock");
    expect(body.threatLabel).toBe("medium");
  });
});

describe("POST /api/summarize input guard (D6)", () => {
  beforeEach(() => {
    vi.stubEnv("AI_MODE", "mock");
    vi.stubEnv("AI_MOCK_SCENARIO", "success");
    resetMockAiClient();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Cowrie-shaped but one character over the cap, so only the length check fails.
  const OVERSIZED = EXCERPT + " ".repeat(MAX_EXCERPT_CHARS + 1 - EXCERPT.length);

  it.each([
    ["empty input", "", EMPTY_MESSAGE],
    ["whitespace-only input", "  \n\t  ", EMPTY_MESSAGE],
    ["4,001 characters", OVERSIZED, tooLongMessage(4001)],
    ["non-Cowrie text", "please summarize my grocery list", NOT_COWRIE_MESSAGE],
  ])("rejects %s with 400 and never calls the AI", async (_name, excerpt, message) => {
    const response = await POST(summarizeRequest({ excerpt }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: message });
    expect(getLastMockRequest()).toBeNull();
  });

  it("states the actual count for oversized input instead of truncating", async () => {
    expect(OVERSIZED.length).toBe(4001);

    const response = await POST(summarizeRequest({ excerpt: OVERSIZED }));

    expect((await response.json()).error).toContain("4,001");
    expect(getLastMockRequest()).toBeNull();
  });

  it("accepts a Cowrie excerpt of exactly 4,000 characters, unchanged", async () => {
    const atCap = EXCERPT + " ".repeat(MAX_EXCERPT_CHARS - EXCERPT.length);

    const response = await POST(summarizeRequest({ excerpt: atCap }));

    expect(response.status).toBe(200);
    expect(getLastMockRequest()?.userMessage).toBe(`<log_excerpt>\n${atCap}\n</log_excerpt>`);
  });

  it("treats a missing excerpt or a body that isn't JSON as empty", async () => {
    const missing = await POST(summarizeRequest({}));
    const notJson = await POST(
      new Request("http://localhost/api/summarize", { method: "POST", body: "not json" }),
    );

    for (const response of [missing, notJson]) {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: EMPTY_MESSAGE });
    }
    expect(getLastMockRequest()).toBeNull();
  });
});
