// Browser-safe half of the rate limit (D8): no Node imports, so the dashboard
// can use it.
export const DEFAULT_RETRY_AFTER_SECONDS = 60;
// No source can lock Summarize for longer than this (e.g. Retry-After: 99999).
export const MAX_RETRY_AFTER_SECONDS = 300;

export const rateLimitMessage = (seconds: number) =>
  `Only one summary per minute. Try again in about ${seconds} seconds.`;

function positiveWholeSeconds(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

// How long the dashboard waits after a 429. The route's body is the source;
// if it is missing or malformed (say the 429 came from a proxy), use the
// Retry-After header in seconds, and if that is missing too, a full minute.
// Whatever the source, the wait is capped at MAX_RETRY_AFTER_SECONDS.
export function readRetryAfter(
  body: unknown,
  retryAfterHeader: string | null,
): { message: string; seconds: number } {
  const fromBody =
    typeof body === "object" && body !== null
      ? positiveWholeSeconds((body as { retryAfterSeconds?: unknown }).retryAfterSeconds)
      : null;
  const fromHeader =
    retryAfterHeader && /^\d+$/.test(retryAfterHeader.trim())
      ? positiveWholeSeconds(Number(retryAfterHeader.trim()))
      : null;
  const seconds = Math.min(
    fromBody ?? fromHeader ?? DEFAULT_RETRY_AFTER_SECONDS,
    MAX_RETRY_AFTER_SECONDS,
  );
  return { message: rateLimitMessage(seconds), seconds };
}
