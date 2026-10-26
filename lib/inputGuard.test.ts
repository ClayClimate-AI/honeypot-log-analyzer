import { describe, expect, it } from "vitest";
import {
  checkExcerpt,
  checkExcerptBasics,
  EMPTY_MESSAGE,
  MAX_EXCERPT_CHARS,
  NOT_COWRIE_MESSAGE,
  tooLongMessage,
  uploadTooLargeMessage,
} from "./inputGuard";

const COWRIE_LINE = '{"eventid":"cowrie.login.failed","src_ip":"203.0.113.42"}';

describe("checkExcerptBasics", () => {
  it("rejects empty and whitespace-only input", () => {
    expect(checkExcerptBasics("")).toEqual({ ok: false, error: EMPTY_MESSAGE });
    expect(checkExcerptBasics("  \n\t ")).toEqual({ ok: false, error: EMPTY_MESSAGE });
  });

  it("accepts exactly the cap and rejects one character over with the actual count", () => {
    expect(checkExcerptBasics("a".repeat(MAX_EXCERPT_CHARS))).toEqual({ ok: true });
    expect(checkExcerptBasics("a".repeat(MAX_EXCERPT_CHARS + 1))).toEqual({
      ok: false,
      error: tooLongMessage(4001),
    });
    expect(tooLongMessage(4001)).toContain("4,001");
  });

  it("does not check for Cowrie events", () => {
    expect(checkExcerptBasics("hello")).toEqual({ ok: true });
  });
});

describe("checkExcerpt", () => {
  it("accepts input with at least one Cowrie event line", () => {
    expect(checkExcerpt(COWRIE_LINE)).toEqual({ ok: true });
    expect(checkExcerpt(`some noise\n  ${COWRIE_LINE}  \r\nmore noise`)).toEqual({ ok: true });
  });

  it.each([
    ["plain text", "summarize this please"],
    ["a JSON object without eventid", '{"src_ip":"203.0.113.42"}'],
    ["a non-Cowrie eventid", '{"eventid":"sshd.login"}'],
    ["cowrie. not at the start", '{"eventid":"not.cowrie.login"}'],
    ["a non-string eventid", '{"eventid":42}'],
    ["a JSON array", '[{"eventid":"cowrie.login.failed"}]'],
    ["a JSON string", '"cowrie.login.failed"'],
    ["JSON null", "null"],
    ["a Cowrie event split across lines", '{"eventid":\n"cowrie.login.failed"}'],
  ])("rejects %s", (_name, excerpt) => {
    expect(checkExcerpt(excerpt)).toEqual({ ok: false, error: NOT_COWRIE_MESSAGE });
  });

  it("runs the empty and length checks first", () => {
    expect(checkExcerpt(" ")).toEqual({ ok: false, error: EMPTY_MESSAGE });
    const oversized = `${COWRIE_LINE}\n${"a".repeat(MAX_EXCERPT_CHARS)}`;
    expect(checkExcerpt(oversized)).toEqual({
      ok: false,
      error: tooLongMessage(oversized.length),
    });
  });
});

describe("uploadTooLargeMessage", () => {
  it("states the file size in KB and the 50 KB limit", () => {
    expect(uploadTooLargeMessage(51 * 1024 + 1)).toBe(
      "That file is 52 KB. The upload limit is 50 KB.",
    );
  });
});
