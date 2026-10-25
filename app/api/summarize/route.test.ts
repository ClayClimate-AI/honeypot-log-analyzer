import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLastMockRequest, resetMockAiClient } from "../../../lib/mockAiClient";
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

  it("records the outgoing request in the mock", async () => {
    await POST(summarizeRequest({ excerpt: EXCERPT }));

    expect(getLastMockRequest()).toEqual({ excerpt: EXCERPT });
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
