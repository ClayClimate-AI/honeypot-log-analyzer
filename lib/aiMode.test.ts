import { describe, expect, it } from "vitest";
import { getAiMode } from "./aiMode";

describe("getAiMode", () => {
  it("defaults to mock when AI_MODE is unset", () => {
    expect(getAiMode({})).toBe("mock");
  });

  it("returns live only for the exact value 'live'", () => {
    expect(getAiMode({ AI_MODE: "live" })).toBe("live");
  });

  it("falls back to mock for any other value", () => {
    expect(getAiMode({ AI_MODE: "LIVE" })).toBe("mock");
    expect(getAiMode({ AI_MODE: "" })).toBe("mock");
  });
});
