import { describe, expect, it } from "vitest";
import { costUsd } from "./cost";

describe("costUsd", () => {
  it("is zero for zero usage", () => {
    expect(costUsd({ inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("prices input at $0.10 and output at $0.50 per 1M tokens", () => {
    expect(costUsd({ inputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(0.1);
    expect(costUsd({ inputTokens: 0, outputTokens: 1_000_000 })).toBeCloseTo(0.5);
  });

  // The D4 near-cap estimate (no thinking tokens). The input card's range now
  // tops out at $0.0008, from measured live sample runs that include thinking (D13).
  it("matches the D4 estimate of about $0.0003 for 1,400 in + 250 out", () => {
    expect(costUsd({ inputTokens: 1_400, outputTokens: 250 })).toBeCloseTo(0.000265, 9);
  });
});
