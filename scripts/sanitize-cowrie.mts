// Builds fixtures/sample-session.jsonl from a raw local cowrie.json (D3).
// Allowlist, not blocklist: only the allowed fields survive, every source IP
// is swapped for a documentation address, and the session is moved to one
// fake date and start time with its real gaps between events kept. Anything
// it can't make safe (a non-default username or password, a real-looking IP
// or domain in a command) stops the run instead of being guessed at.
//
// Usage: node scripts/sanitize-cowrie.mts <raw cowrie.json> <output .jsonl>
// The raw file stays on Joseph's Mac and is never committed.

import { readFileSync, writeFileSync } from "node:fs";
import {
  ALLOWED_FIELDS,
  DEFAULT_PASSWORDS,
  DEFAULT_USERNAMES,
  findCommandProblems,
  FIXTURE_MAX_CHARS,
} from "../lib/fixtureRules.mts";

// Events that tell the story of a session; the rest (client version, key
// exchange, terminal size, log closed) carry nothing the allowlist keeps.
const KEPT_EVENTS = new Set([
  "cowrie.session.connect",
  "cowrie.login.failed",
  "cowrie.login.success",
  "cowrie.command.input",
  "cowrie.command.failed",
  "cowrie.session.file_download",
  "cowrie.session.closed",
]);

// The first kept event lands here; later ones keep their offset from it.
const FAKE_START = Date.parse("2026-01-15T03:00:00.000Z");
const FAKE_IP_PREFIX = "203.0.113.";
const FIRST_FAKE_HOST = 10;

function fail(lineNumber: number, reason: string): never {
  throw new Error(`Line ${lineNumber} of the raw log: ${reason}`);
}

function sanitize(raw: string): string {
  const fakeIps = new Map<string, string>();
  let realStart: number | null = null;
  const output: string[] = [];

  raw.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    if (line.trim() === "") {
      return;
    }
    const event = JSON.parse(line) as Record<string, unknown>;
    if (typeof event.eventid !== "string" || !KEPT_EVENTS.has(event.eventid)) {
      return;
    }

    const clean: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (event[field] !== undefined) {
        clean[field] = event[field];
      }
    }

    if (typeof clean.src_ip === "string") {
      if (!fakeIps.has(clean.src_ip)) {
        fakeIps.set(clean.src_ip, `${FAKE_IP_PREFIX}${FIRST_FAKE_HOST + fakeIps.size}`);
      }
      clean.src_ip = fakeIps.get(clean.src_ip);
    }

    if (typeof clean.timestamp === "string") {
      const real = Date.parse(clean.timestamp);
      if (Number.isNaN(real)) {
        fail(lineNumber, "timestamp is not a valid date.");
      }
      realStart ??= real;
      clean.timestamp = new Date(FAKE_START + (real - realStart)).toISOString();
    }

    // Usernames and passwords are never printed, in case they were real.
    if (clean.username !== undefined && !DEFAULT_USERNAMES.has(String(clean.username))) {
      fail(lineNumber, "username is not one of the allowed defaults (root, admin).");
    }
    if (clean.password !== undefined && !DEFAULT_PASSWORDS.has(String(clean.password))) {
      fail(lineNumber, "password is not one of the allowed defaults (123456, admin).");
    }

    if (typeof clean.input === "string") {
      const [problem] = findCommandProblems(clean.input);
      if (problem) {
        fail(lineNumber, problem);
      }
    }

    output.push(JSON.stringify(clean));
  });

  const text = `${output.join("\n")}\n`;
  if (text.length >= FIXTURE_MAX_CHARS) {
    throw new Error(
      `Sanitized output is ${text.length} characters; it must be under ${FIXTURE_MAX_CHARS}. Use a shorter session.`,
    );
  }
  return text;
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/sanitize-cowrie.mts <raw cowrie.json> <output .jsonl>");
  process.exit(1);
}
const text = sanitize(readFileSync(inputPath, "utf8"));
writeFileSync(outputPath, text);
console.log(`Wrote ${text.length} characters to ${outputPath}`);
