import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMockAiClient } from "../../../lib/mockAiClient";
import { resetRateLimit } from "../../../lib/rateLimit";
import { type SavedRunInput, setRunStoreForTests } from "../../../lib/runStore";
import { POST } from "./route";

// The live SDK call is replaced here, so live mode runs without a key or a
// network. Everything after the call (output guard, save) is the real code.
const liveReply = vi.hoisted(() => ({
  text: "",
  stopReason: "end_turn",
  usage: { inputTokens: 1_200, outputTokens: 300 },
}));
vi.mock("../../../lib/liveAiClient", () => ({
  liveAiClient: async () => liveReply,
}));

const EXCERPT =
  '{"eventid":"cowrie.login.success","username":"root","password":"admin","src_ip":"203.0.113.10"}';

const GOOD_SUMMARY = "Root logged in from 203.0.113.10 and ran whoami. Watch for payloads.";

function summarize() {
  return POST(
    new Request("http://localhost/api/summarize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ excerpt: EXCERPT }),
    }),
  );
}

describe("POST /api/summarize saves live runs (D18)", () => {
  let saved: SavedRunInput[];

  beforeEach(() => {
    vi.stubEnv("AI_MODE", "live");
    liveReply.text = JSON.stringify({ summary: GOOD_SUMMARY, threatLabel: "high" });
    liveReply.stopReason = "end_turn";
    saved = [];
    setRunStoreForTests({ saveRun: async (run) => void saved.push(run) });
    resetMockAiClient();
    resetRateLimit();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setRunStoreForTests(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("saves one redacted row and still shows the unredacted summary", async () => {
    const response = await summarize();

    expect(response.status).toBe(200);
    expect((await response.json()).summary).toBe(GOOD_SUMMARY);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      summary: "Root logged in from attacker IP and ran whoami. Watch for payloads.",
      threatLabel: "high",
      mode: "live",
      inputTokens: 1_200,
      outputTokens: 300,
      excerptLength: EXCERPT.length,
    });
    expect(JSON.stringify(saved[0])).not.toContain(EXCERPT);
  });

  it("does not save when the output guard rejects the reply", async () => {
    liveReply.text = JSON.stringify({ summary: GOOD_SUMMARY, threatLabel: "none" });

    const response = await summarize();

    expect(response.status).toBe(502);
    expect(saved).toEqual([]);
  });

  it("does not save mock runs", async () => {
    vi.stubEnv("AI_MODE", "mock");
    vi.stubEnv("AI_MOCK_SCENARIO", "success");

    const response = await summarize();

    expect(response.status).toBe(200);
    expect((await response.json()).mode).toBe("mock");
    expect(saved).toEqual([]);
  });

  it("still returns the summary when the database fails", async () => {
    setRunStoreForTests({ saveRun: async () => Promise.reject(new Error("db down")) });

    const response = await summarize();

    expect(response.status).toBe(200);
    expect((await response.json()).summary).toBe(GOOD_SUMMARY);
    expect(console.error).toHaveBeenCalledWith("history_save_failed", {
      reason: "error",
      kind: "Error",
    });
  });
});
