import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkExcerpt } from "../lib/inputGuard";
import {
  ALLOWED_FIELDS,
  DEFAULT_PASSWORDS,
  DEFAULT_USERNAMES,
  findCommandProblems,
  findIpv4,
  findIpv6,
  FIXTURE_MAX_CHARS,
  isDocumentationIp,
  isPrivateIp,
} from "../lib/fixtureRules.mts";

// Enforces the D3 fixture rules on the committed sample. The file ships in
// the browser bundle, so every rule here is about it revealing nothing about
// Joseph's honeypot, Mac or network. Read with fs: Vitest doesn't use the
// Turbopack text rule that the app's import relies on.

const fixture = readFileSync(new URL("./sample-session.jsonl", import.meta.url), "utf8");
const lines = fixture.split("\n").filter((line) => line.trim() !== "");
const events = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
const allowedFields = new Set<string>(ALLOWED_FIELDS);

const INJECTION = /\b(?:ignore|disregard)\b.*\b(?:rules|instructions)\b|\blabel (?:this|the) session\b/i;

const inputs = events
  .map((event) => event.input)
  .filter((input): input is string => typeof input === "string");

describe("fixtures/sample-session.jsonl", () => {
  it("is under 3,000 characters", () => {
    expect(fixture.length).toBeLessThan(FIXTURE_MAX_CHARS);
  });

  it("has a JSON object with a cowrie. eventid on every line", () => {
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(typeof event === "object" && event !== null && !Array.isArray(event)).toBe(true);
      expect(String(event.eventid)).toMatch(/^cowrie\./);
    }
  });

  it("keeps only allowlisted fields", () => {
    for (const event of events) {
      for (const key of Object.keys(event)) {
        expect(allowedFields.has(key), `unexpected field ${key}`).toBe(true);
      }
    }
  });

  it("uses only documentation IPv4 addresses, anywhere in the file, and no private ranges", () => {
    const ips = findIpv4(fixture);
    expect(ips.length).toBeGreaterThan(0);
    for (const ip of ips) {
      expect(isDocumentationIp(ip), `${ip} is not a documentation IP`).toBe(true);
      expect(isPrivateIp(ip), `${ip} is a private IP`).toBe(false);
    }
    for (const event of events) {
      if (event.src_ip !== undefined) {
        expect(isDocumentationIp(String(event.src_ip))).toBe(true);
      }
    }
  });

  it("has no IPv6 addresses", () => {
    expect(findIpv6(fixture)).toEqual([]);
  });

  it("has no unsafe IPs or hosts in any command", () => {
    for (const input of inputs) {
      expect(findCommandProblems(input)).toEqual([]);
    }
  });

  it("uses one fixed fake date", () => {
    const dates = new Set(events.map((event) => String(event.timestamp).slice(0, 10)));
    expect(dates.size).toBe(1);
    expect([...dates][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("uses only default usernames and passwords", () => {
    for (const event of events) {
      if (event.username !== undefined) {
        expect(DEFAULT_USERNAMES.has(String(event.username))).toBe(true);
      }
      if (event.password !== undefined) {
        expect(DEFAULT_PASSWORDS.has(String(event.password))).toBe(true);
      }
    }
  });

  it("has exactly one injection-style command line", () => {
    expect(inputs.filter((input) => INJECTION.test(input))).toHaveLength(1);
  });

  it("passes the same input guard as a paste", () => {
    expect(checkExcerpt(fixture)).toEqual({ ok: true });
  });
});
