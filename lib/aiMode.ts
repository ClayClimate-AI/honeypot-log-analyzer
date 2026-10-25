// Server-only setting (D9). The browser can never switch it.
// Anything other than exactly "live" means mock, so a missing or mistyped
// value never spends real tokens.
export type AiMode = "mock" | "live";

export function getAiMode(env: Record<string, string | undefined> = process.env): AiMode {
  return env.AI_MODE === "live" ? "live" : "mock";
}
