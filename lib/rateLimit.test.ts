import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  clientKey,
  rateLimitMessage,
  resetRateLimit,
  takeRateLimit,
  WINDOW_MS,
} from "./rateLimit";

const IP = "198.51.100.7";

describe("clientKey (D8, check 12)", () => {
  it("hashes the connection IP and never keeps it raw", () => {
    const client = clientKey(new Headers({ "x-nf-client-connection-ip": IP }));

    expect(client.ipHeaderPresent).toBe(true);
    expect(client.key).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(client.key).not.toContain(IP);
  });

  it("gives the same IP the same key and different IPs different keys", () => {
    const a = clientKey(new Headers({ "x-nf-client-connection-ip": IP }));
    const again = clientKey(new Headers({ "x-nf-client-connection-ip": IP }));
    const b = clientKey(new Headers({ "x-nf-client-connection-ip": "198.51.100.8" }));

    expect(again.key).toBe(a.key);
    expect(b.key).not.toBe(a.key);
  });

  it.each([
    ["no headers", {}],
    ["an empty connection IP", { "x-nf-client-connection-ip": "  " }],
    [
      "only forwarding headers",
      {
        "x-forwarded-for": IP,
        "client-ip": IP,
        "x-real-ip": IP,
        forwarded: `for=${IP}`,
        cookie: `ip=${IP}`,
      },
    ],
  ])("puts %s in the shared bucket", (_name, headers) => {
    expect(clientKey(new Headers(headers))).toEqual({ key: "shared", ipHeaderPresent: false });
  });

  it("ignores forwarding headers when the connection IP is present", () => {
    const plain = clientKey(new Headers({ "x-nf-client-connection-ip": IP }));
    const forged = clientKey(
      new Headers({ "x-nf-client-connection-ip": IP, "x-forwarded-for": "203.0.113.99" }),
    );

    expect(forged.key).toBe(plain.key);
  });
});

describe("checkRateLimit / takeRateLimit", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it("lets the first request through and blocks a second inside the minute", () => {
    expect(takeRateLimit("k", 1_000)).toEqual({ ok: true });
    expect(checkRateLimit("k", 1_001)).toEqual({ ok: false, retryAfterSeconds: 60 });
    expect(takeRateLimit("k", 31_000)).toEqual({ ok: false, retryAfterSeconds: 30 });
  });

  it("frees the client once the minute is over", () => {
    takeRateLimit("k", 0);

    expect(checkRateLimit("k", WINDOW_MS - 1)).toEqual({ ok: false, retryAfterSeconds: 1 });
    expect(takeRateLimit("k", WINDOW_MS)).toEqual({ ok: true });
  });

  it("checking never uses up the minute", () => {
    checkRateLimit("k", 0);
    checkRateLimit("k", 1);

    expect(takeRateLimit("k", 2)).toEqual({ ok: true });
  });

  it("a blocked take doesn't restart the minute", () => {
    takeRateLimit("k", 0);
    takeRateLimit("k", 59_000);

    expect(takeRateLimit("k", WINDOW_MS)).toEqual({ ok: true });
  });

  it("keeps separate keys separate", () => {
    takeRateLimit("a", 0);

    expect(takeRateLimit("b", 1)).toEqual({ ok: true });
  });

  it("states the wait in the message", () => {
    expect(rateLimitMessage(42)).toBe("Only one summary per minute. Try again in about 42 seconds.");
  });
});
