import { APIConnectionTimeoutError, APIError } from "@anthropic-ai/sdk";

// D7: when the AI call throws, map the error to two things. The log entry is
// for Joseph: a short code plus a status or elapsed time. The screen message
// is for the visitor. Neither ever includes the key, headers, a stack trace
// or the provider's raw error text (the two audiences rule).
export const TIMEOUT_MESSAGE =
  "The AI didn't respond in time. Your log text is still here; try again in a moment.";
export const BUSY_MESSAGE = "The AI service is busy. Try again in a minute.";

export type FailureCode = "ai_timeout" | "ai_rate_limited" | "ai_unavailable" | "ai_auth_error";

export type AiFailure = {
  code: FailureCode;
  httpStatus: number;
  message: string;
  // Only numbers and short codes go in here, so it is always safe to log.
  logDetail: Record<string, number | string>;
};

export function mapAiError(error: unknown, elapsedMs: number): AiFailure {
  // Checked before APIError: a timeout is also an APIError with no status.
  if (error instanceof APIConnectionTimeoutError) {
    return {
      code: "ai_timeout",
      httpStatus: 504,
      message: TIMEOUT_MESSAGE,
      logDetail: { elapsedMs },
    };
  }

  const status = error instanceof APIError ? error.status : undefined;

  if (status === 429) {
    return { code: "ai_rate_limited", httpStatus: 503, message: BUSY_MESSAGE, logDetail: { status } };
  }
  if (status === 401 || status === 403) {
    return { code: "ai_auth_error", httpStatus: 503, message: TIMEOUT_MESSAGE, logDetail: { status } };
  }
  // 5xx, a connection error (no status), any other provider status, or an
  // error that isn't from the SDK at all.
  return {
    code: "ai_unavailable",
    httpStatus: 503,
    message: TIMEOUT_MESSAGE,
    logDetail: { status: status ?? "none" },
  };
}
