import { createHash, randomBytes } from "node:crypto";

// D8: one summary per minute per client, enforced in the route handler.
// Known Week 6 limitation: this lives in memory, so it is per function
// instance and resets on a cold start. The workspace spend limit (D4) is the
// hard backstop.
export const WINDOW_MS = 60_000;

// The only header the key may come from. Netlify sets it from the TCP
// connection, so a client can't choose it. Never x-forwarded-for, client-ip,
// x-real-ip, forwarded, the body, the query string or cookies (check 12).
export const CLIENT_IP_HEADER = "x-nf-client-connection-ip";

// Every request without the header shares this one bucket (always the case
// locally), so a missing header tightens the limit instead of loosening it.
const SHARED_BUCKET = "shared";

// Random per process, so a stored hash can't be reversed by hashing every
// IPv4 address. Only the hash is stored; the raw IP is never kept or logged.
const SALT = randomBytes(16).toString("hex");

export type ClientKey = { key: string; ipHeaderPresent: boolean };

export function clientKey(headers: Headers): ClientKey {
  const ip = headers.get(CLIENT_IP_HEADER)?.trim();
  if (!ip) {
    return { key: SHARED_BUCKET, ipHeaderPresent: false };
  }
  const hash = createHash("sha256").update(SALT).update(ip).digest("hex");
  return { key: `ip:${hash}`, ipHeaderPresent: true };
}

export const rateLimitMessage = (seconds: number) =>
  `Only one summary per minute. Try again in about ${seconds} seconds.`;

export type RateCheck = { ok: true } | { ok: false; retryAfterSeconds: number };

// Key → time the client's minute started.
const windows = new Map<string, number>();

// Looks without using up the minute.
export function checkRateLimit(key: string, now = Date.now()): RateCheck {
  const startedAt = windows.get(key);
  if (startedAt === undefined || now - startedAt >= WINDOW_MS) {
    return { ok: true };
  }
  return { ok: false, retryAfterSeconds: Math.ceil((startedAt + WINDOW_MS - now) / 1000) };
}

// Uses up the minute, only for a request that reaches the AI call. Checks
// again in the same synchronous step, so two requests that both passed the
// first check can't both get through.
export function takeRateLimit(key: string, now = Date.now()): RateCheck {
  const check = checkRateLimit(key, now);
  if (check.ok) {
    // Drop expired windows so the map can't grow without bound.
    for (const [storedKey, startedAt] of windows) {
      if (now - startedAt >= WINDOW_MS) {
        windows.delete(storedKey);
      }
    }
    windows.set(key, now);
  }
  return check;
}

// Test-only reset.
export function resetRateLimit(): void {
  windows.clear();
}
