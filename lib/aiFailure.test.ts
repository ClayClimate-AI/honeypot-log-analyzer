import { APIConnectionError, APIConnectionTimeoutError, APIError } from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { BUSY_MESSAGE, mapAiError, TIMEOUT_MESSAGE } from "./aiFailure";

const RAW = "raw provider text sk-ant-should-never-show";

// Builds the same error subclass the SDK throws for that HTTP status.
function apiError(status: number): APIError {
  return APIError.generate(status, { error: { message: RAW } }, RAW, new Headers({ "x-api-key": RAW }));
}

describe("mapAiError (D7)", () => {
  it.each([
    ["timeout", new APIConnectionTimeoutError({ message: RAW }), "ai_timeout", 504, TIMEOUT_MESSAGE, { elapsedMs: 8001 }],
    ["provider 429", apiError(429), "ai_rate_limited", 503, BUSY_MESSAGE, { status: 429 }],
    ["401", apiError(401), "ai_auth_error", 503, TIMEOUT_MESSAGE, { status: 401 }],
    ["403", apiError(403), "ai_auth_error", 503, TIMEOUT_MESSAGE, { status: 403 }],
    ["500", apiError(500), "ai_unavailable", 503, TIMEOUT_MESSAGE, { status: 500 }],
    ["529 overloaded", apiError(529), "ai_unavailable", 503, TIMEOUT_MESSAGE, { status: 529 }],
    ["connection error", new APIConnectionError({ message: RAW }), "ai_unavailable", 503, TIMEOUT_MESSAGE, { status: "none" }],
    ["a non-SDK error", new Error(RAW), "ai_unavailable", 503, TIMEOUT_MESSAGE, { status: "none" }],
  ])("maps a %s", (_name, error, code, httpStatus, message, logDetail) => {
    expect(mapAiError(error, 8001)).toEqual({ code, httpStatus, message, logDetail });
  });

  it("never carries the raw error text, headers or stack", () => {
    const failure = mapAiError(apiError(401), 120);

    expect(JSON.stringify(failure)).not.toContain(RAW);
    expect(Object.keys(failure).sort()).toEqual(["code", "httpStatus", "logDetail", "message"]);
  });
});
