import type { AiUsage } from "./aiClient";

// Claude Haiku 5.5, USD per 1M tokens (prompts up to 100K tokens; the 4,000
// character cap keeps every call far below that).
// Price date: 2026-10-06, from the claude-api skill's cached model table.
// Joseph re-confirms these on the Anthropic pricing page.
export const PRICE_DATE = "2026-10-06";
export const INPUT_USD_PER_MILLION = 0.1;
export const OUTPUT_USD_PER_MILLION = 0.5;

// Computed on the server from the usage the API reports (D13). Mock usage is
// zero, so mock cost is zero.
export function costUsd(usage: AiUsage): number {
  return (
    (usage.inputTokens * INPUT_USD_PER_MILLION +
      usage.outputTokens * OUTPUT_USD_PER_MILLION) /
    1_000_000
  );
}
