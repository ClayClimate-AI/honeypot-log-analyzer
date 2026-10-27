import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  MAX_RETRY_AFTER_SECONDS,
  rateLimitMessage,
  readRetryAfter,
} from "./retryAfter";

const wait = (seconds: number) => ({ message: rateLimitMessage(seconds), seconds });

describe("readRetryAfter (D8 fallback for a 429)", () => {
  it("uses the route's body when it is well formed", () => {
    expect(readRetryAfter({ error: "x", retryAfterSeconds: 42 }, "10")).toEqual(wait(42));
  });

  it.each([
    ["a missing body", null],
    ["a body that isn't an object", "Too Many Requests"],
    ["a body without retryAfterSeconds", { error: "slow down" }],
    ["retryAfterSeconds as a string", { retryAfterSeconds: "42" }],
    ["a zero retryAfterSeconds", { retryAfterSeconds: 0 }],
    ["a negative retryAfterSeconds", { retryAfterSeconds: -5 }],
    ["a fractional retryAfterSeconds", { retryAfterSeconds: 1.5 }],
  ])("falls back to the Retry-After header for %s", (_name, body) => {
    expect(readRetryAfter(body, "17")).toEqual(wait(17));
  });

  it.each([
    ["a missing body and no header", null, null],
    ["a malformed body and no header", { retryAfterSeconds: "soon" }, null],
    ["an empty header", null, ""],
    ["a non-numeric header", null, "soon"],
    ["an HTTP-date header", null, "Wed, 21 Oct 2026 07:28:00 GMT"],
    ["a zero header", null, "0"],
  ])("defaults to 60 seconds for %s", (_name, body, header) => {
    expect(readRetryAfter(body, header)).toEqual(wait(DEFAULT_RETRY_AFTER_SECONDS));
  });

  it.each([
    ["a huge Retry-After header", null, "99999"],
    ["a huge body value", { retryAfterSeconds: 99999 }, null],
    ["a body value just over the cap", { retryAfterSeconds: 301 }, "10"],
  ])("caps %s at 300 seconds", (_name, body, header) => {
    expect(readRetryAfter(body, header)).toEqual(wait(MAX_RETRY_AFTER_SECONDS));
  });

  it("keeps a wait of exactly 300 seconds", () => {
    expect(readRetryAfter(null, "300")).toEqual(wait(300));
  });

  it("gives the same message text as the route", () => {
    expect(readRetryAfter(null, null).message).toBe(
      "Only one summary per minute. Try again in about 60 seconds.",
    );
  });
});
