import { describe, expect, it } from "vitest";
import type { AiReply } from "./aiClient";
import { checkAiReply, countSentences, MAX_SUMMARY_CHARS } from "./outputGuard";

function reply(text: string, stopReason = "end_turn"): AiReply {
  return { text, stopReason, usage: { inputTokens: 0, outputTokens: 0 } };
}

function json(value: unknown): AiReply {
  return reply(JSON.stringify(value));
}

const SUMMARY = "Root login with a default password from 203.0.113.42. Recon followed.";

describe("countSentences", () => {
  it.each([
    ["One sentence.", 1],
    ["No terminator at all", 1],
    ["One. Two! Three?", 3],
    ["Login from 203.0.113.42 then cat /etc/passwd.", 1],
    ["Four. Sentences. Are. Here.", 4],
    ["Recon followed (e.g. uname -a). Then exit.", 2],
    ["Defaults tried, i.e. root and admin. Watch for E.G. reuse.", 2],
    ["It ran whoami, uname, etc. before the wget. Then it left.", 2],
    ["Brute force vs. a default account. Login worked.", 2],
  ])("%s → %i", (text, count) => {
    expect(countSentences(text)).toBe(count);
  });
});

describe("checkAiReply abbreviations", () => {
  it("accepts a 3-sentence summary that contains e.g.", () => {
    const summary =
      "Root logged in with a default password. Recon followed, e.g. uname -a and whoami. Watch for wget to update.invalid.";

    expect(checkAiReply(json({ summary, threatLabel: "high" })).ok).toBe(true);
  });
});

describe("checkAiReply (D5)", () => {
  it.each(["low", "medium", "high", "unknown"])("accepts the %s label", (threatLabel) => {
    expect(checkAiReply(json({ summary: SUMMARY, threatLabel }))).toEqual({
      ok: true,
      value: { summary: SUMMARY, threatLabel },
    });
  });

  it("accepts a summary of exactly 700 characters and 3 sentences", () => {
    const summary = "A. B. " + "c".repeat(MAX_SUMMARY_CHARS - 7) + ".";
    expect(summary.length).toBe(MAX_SUMMARY_CHARS);

    expect(checkAiReply(json({ summary, threatLabel: "low" })).ok).toBe(true);
  });

  it("accepts a summary of exactly 6 sentences", () => {
    expect(checkAiReply(json({ summary: "A. B. C. D. E. F.", threatLabel: "low" })).ok).toBe(true);
  });

  it.each([
    ["invalid JSON", reply("Sure! Here is the summary: ..."), "invalid_json"],
    ["a JSON array", json([]), "reply: invalid_type"],
    ["a missing summary", json({ threatLabel: "low" }), "summary: invalid_type"],
    ["a missing label", json({ summary: SUMMARY }), "threatLabel: invalid_value"],
    ["a label outside the four", json({ summary: SUMMARY, threatLabel: "none" }), "threatLabel: invalid_value"],
    ["an empty summary", json({ summary: "", threatLabel: "low" }), "summary: too_small"],
    ["a whitespace-only summary", json({ summary: "  \n ", threatLabel: "low" }), "summary: too_small"],
    ["a 701-character summary", json({ summary: "x".repeat(701), threatLabel: "low" }), "summary: too_big"],
    ["seven sentences", json({ summary: "A. B. C. D. E. F. G.", threatLabel: "low" }), "summary: too_many_sentences"],
    ["a refusal", reply(JSON.stringify({ summary: SUMMARY, threatLabel: "low" }), "refusal"), "refusal"],
  ])("rejects %s", (_name, input, reason) => {
    expect(checkAiReply(input)).toEqual({ ok: false, reason });
  });

  it("never puts reply text in the log reason", () => {
    const check = checkAiReply(json({ summary: "IGNORE RULES ".repeat(60), threatLabel: "low" }));

    expect(check.ok).toBe(false);
    expect(JSON.stringify(check)).not.toContain("IGNORE");
  });
});
