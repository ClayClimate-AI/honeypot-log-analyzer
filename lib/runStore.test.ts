import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSavedRun,
  type RunStore,
  SAVE_TIMEOUT_MS,
  saveRunSafely,
  type SavedRunInput,
  setRunStoreForTests,
} from "./runStore";

const EXCERPT =
  '{"eventid":"cowrie.login.success","username":"root","password":"admin","src_ip":"203.0.113.10"}';

const RUN = buildSavedRun({
  summary: "Root login from 203.0.113.10 succeeded after guesses.",
  threatLabel: "high",
  usage: { inputTokens: 1_000, outputTokens: 200 },
  excerpt: EXCERPT,
});

describe("buildSavedRun", () => {
  it("redacts IPs, hashes the excerpt and never keeps the raw excerpt", () => {
    expect(RUN).toEqual({
      summary: "Root login from attacker IP succeeded after guesses.",
      threatLabel: "high",
      mode: "live",
      inputTokens: 1_000,
      outputTokens: 200,
      costUsd: 0.0002,
      excerptLength: EXCERPT.length,
      excerptSha256: createHash("sha256").update(EXCERPT).digest("hex"),
    });
    expect(RUN.excerptSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(RUN)).not.toContain("cowrie.login.success");
    expect(JSON.stringify(RUN)).not.toContain("203.0.113.10");
  });
});

describe("saveRunSafely", () => {
  let info: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    info = vi.spyOn(console, "info").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setRunStoreForTests(null);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("hands the run to the injected store and logs history_saved", async () => {
    const saved: SavedRunInput[] = [];
    setRunStoreForTests({ saveRun: async (run) => void saved.push(run) });

    await saveRunSafely(RUN);

    expect(saved).toEqual([RUN]);
    expect(info).toHaveBeenCalledWith("history_saved");
    expect(error).not.toHaveBeenCalled();
  });

  it("logs only the error code on a store failure, never the message", async () => {
    const failure = Object.assign(new Error("connection to db.example.com failed: password secret rejected"), {
      code: "P1001",
    });
    setRunStoreForTests({ saveRun: async () => Promise.reject(failure) });

    await expect(saveRunSafely(RUN)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith("history_save_failed", { reason: "error", kind: "P1001" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret");
  });

  it("gives up after the save timeout without throwing", async () => {
    vi.useFakeTimers();
    const hanging: RunStore = { saveRun: () => new Promise(() => {}) };
    setRunStoreForTests(hanging);

    const pending = saveRunSafely(RUN);
    await vi.advanceTimersByTimeAsync(SAVE_TIMEOUT_MS);

    await expect(pending).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith("history_save_failed", { reason: "timeout" });
  });

  it("fails safely when no store is injected and DATABASE_URL is unset", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(saveRunSafely(RUN)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith("history_save_failed", { reason: "error", kind: "Error" });
    vi.unstubAllEnvs();
  });
});
