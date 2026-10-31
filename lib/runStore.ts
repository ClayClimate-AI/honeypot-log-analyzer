import { createHash } from "node:crypto";
import type { AiUsage } from "./aiClient";
import { costUsd } from "./cost";
import type { ThreatLabel } from "./outputGuard";
import { redactIps } from "./redactIps";

// Week 7 Step 3 (D18): one saved row per live summary that passed the output
// guard. Never the raw excerpt: only its length and SHA-256 hash.
export type SavedRunInput = {
  summary: string;
  threatLabel: ThreatLabel;
  mode: "live";
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  excerptLength: number;
  excerptSha256: string;
};

export type RunStore = {
  saveRun(run: SavedRunInput): Promise<void>;
};

// A slow database must not hold the summary back for long. The AI call has
// 8 s (D7), so 8 s + 3 s stays under Netlify's function time limit.
export const SAVE_TIMEOUT_MS = 3_000;

export function buildSavedRun(input: {
  summary: string;
  threatLabel: ThreatLabel;
  usage: AiUsage;
  excerpt: string;
}): SavedRunInput {
  return {
    summary: redactIps(input.summary),
    threatLabel: input.threatLabel,
    mode: "live",
    inputTokens: input.usage.inputTokens,
    outputTokens: input.usage.outputTokens,
    costUsd: costUsd(input.usage),
    excerptLength: input.excerpt.length,
    excerptSha256: createHash("sha256").update(input.excerpt, "utf8").digest("hex"),
  };
}

// Tests inject a fake store here; the builder never connects to the real
// database (CLAUDE.md §11). Without one, the Prisma store is loaded on first
// use, so mock runs and tests never load Prisma at all.
let injectedStore: RunStore | null = null;

export function setRunStoreForTests(store: RunStore | null): void {
  injectedStore = store;
}

async function getRunStore(): Promise<RunStore> {
  if (injectedStore) {
    return injectedStore;
  }
  const { prismaRunStore } = await import("./prismaRunStore");
  return prismaRunStore;
}

// A database failure never blocks the summary (SPEC Step 3). The log gets a
// short code and the error's name or code only, never its message, which can
// carry connection details or row data.
export async function saveRunSafely(run: SavedRunInput): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), SAVE_TIMEOUT_MS);
  });
  try {
    const store = await getRunStore();
    const result = await Promise.race([store.saveRun(run).then(() => "saved" as const), timeout]);
    if (result === "timeout") {
      console.error("history_save_failed", { reason: "timeout" });
      return;
    }
    console.info("history_saved");
  } catch (error) {
    console.error("history_save_failed", { reason: "error", kind: errorKind(error) });
  } finally {
    clearTimeout(timer);
  }
}

function errorKind(error: unknown): string {
  if (error && typeof error === "object") {
    const { code, name } = error as { code?: unknown; name?: unknown };
    if (typeof code === "string") return code;
    if (typeof name === "string") return name;
  }
  return "unknown";
}
