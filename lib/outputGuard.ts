import { z } from "zod";
import type { AiReply } from "./aiClient";

// D5: the output contract. Nothing from the AI reaches the screen unless it
// passes this check first. This is also the hard backstop for prompt
// injection (D14): whatever the excerpt talks the model into, only a short
// summary and one of four labels can come out.
export const THREAT_LABELS = ["low", "medium", "high", "unknown"] as const;
export type ThreatLabel = (typeof THREAT_LABELS)[number];

export const MAX_SUMMARY_CHARS = 700;
export const MAX_SUMMARY_SENTENCES = 6;

export const BAD_OUTPUT_MESSAGE = "Couldn't produce a reliable summary for this excerpt.";

// Abbreviations whose final dot doesn't end a sentence ("e.g. uname").
const ABBREVIATION_AT_END = /\b(?:e\.g|i\.e|etc|vs|approx|incl|cf)\.$/i;

// A sentence ends at . ! or ? followed by whitespace or the end of the text,
// so dotted IPs like 203.0.113.42 and paths like /etc/passwd don't count, and
// neither does an abbreviation in the middle of the text.
export function countSentences(text: string): number {
  const pieces = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  const ends = pieces.filter(
    (piece, index) => index === pieces.length - 1 || !ABBREVIATION_AT_END.test(piece),
  );
  return Math.max(1, ends.length);
}

const SummarySchema = z.object({
  summary: z
    .string()
    .trim()
    .min(1)
    .max(MAX_SUMMARY_CHARS)
    .refine((text) => countSentences(text) <= MAX_SUMMARY_SENTENCES, {
      message: "too_many_sentences",
    }),
  threatLabel: z.enum(THREAT_LABELS),
});

export type Summary = z.infer<typeof SummarySchema>;

// `reason` is for the server log only. It names what failed (a field and a
// rule), never the reply text, because that text can echo attacker data.
export type OutputCheck = { ok: true; value: Summary } | { ok: false; reason: string };

export function checkAiReply(reply: AiReply): OutputCheck {
  // D4: a refusal is bad output, whatever text came with it.
  if (reply.stopReason === "refusal") {
    return { ok: false, reason: "refusal" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.text);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const result = SummarySchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join(".") || "reply";
    const rule = issue.code === "custom" ? issue.message : issue.code;
    return { ok: false, reason: `${field}: ${rule}` };
  }
  return { ok: true, value: result.data };
}
