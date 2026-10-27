# REVIEW.md: Ticket #10 (output guard, threat badge + failure guard)

Verifier pass, Oct 27 2026. Every result here comes only from commands I ran myself (`git status`, `git diff`, R1 to R6, read-only `find`/`grep`) and from files I read. New (untracked) files, read in full: `lib/outputGuard.ts`, `lib/outputGuard.test.ts`, `lib/aiFailure.ts`, `lib/aiFailure.test.ts`. Tracked diffs: `.claude/progress.txt`, `CLAUDE.md`, `app/_components/Dashboard.tsx`, `app/api/summarize/route.ts`, `app/api/summarize/route.test.ts`, `app/page.module.css`, `lib/aiClient.ts`, `lib/liveAiClient.ts`, `lib/mockAiClient.ts`, `package.json`, `package-lock.json`. Also read: `lib/prompt.ts` (unchanged), `lib/liveAiClient.ts` (full), `.gitignore`, and the ticket file `.scratch/cowrie-summarizer/issues/10-output-and-failure-guards.md`.

**Result: 40 PASS / 0 FAIL** (4 N/A). Runtime checks R1 to R6 all passed.

## Runtime checks

| # | Check | Result | Output |
|---|---|---|---|
| R1 | `npm run typecheck` | PASS | `next typegen && tsc --noEmit` → "Types generated successfully", exit 0 |
| R2 | `npm run lint` | PASS | `eslint`, no output, exit 0 |
| R3 | `npm test` | PASS | Vitest 5.0.5: "Test Files 9 passed (9) · Tests 118 passed (118)", exit 0 |
| R4 | Dev server `AI_MODE=mock npx next dev --hostname 127.0.0.1 --port 3100` | PASS | `GET /` returned 200 after about 1 s |
| R5 | Routes | PASS | See below |
| R6 | Stop server | PASS | `lsof -ti tcp:3100` → one PID; `kill` on that PID; re-run of `lsof` returned nothing (exit 1); background task ended with 143 (SIGTERM, expected) |

R5 detail (mock mode, all on `http://localhost:3100`):
- `GET /` → 200. HTML contains "Mock AI" (pill); does not contain "Nothing was charged".
- `POST /api/summarize` with the spec sample payload → 200 `{"summary":"Mock reply: no AI model was called. ...","threatLabel":"medium","mode":"mock","usage":{"inputTokens":0,"outputTokens":0},"costUsd":0}`. Summary is 2 sentences, under 600 chars, so it passed the new Zod check on the real route.
- `POST` `{"excerpt":"   "}` → 400 `{"error":"Paste or upload a Cowrie log excerpt first."}`.
- `POST` `{"excerpt":"hello world","mode":"live"}` → 400 `{"error":"This doesn't look like Cowrie JSON log output."}` (mode in the body ignored).
- `POST` 4,001-char excerpt → 400 `{"error":"That excerpt is 4,001 characters. The limit is 4,000, so trim it and try again."}`.
- `POST` body `not json` → 400 empty-excerpt message.
- `POST` an injection-style Cowrie line containing `</log_excerpt>` → 200 mock contract (input path accepts it; tag neutralized in `buildUserMessage`).
- Dev server log: no `error`, `Error`, `ai_` or warn lines during these requests.
- N/A at runtime: the `bad_output`, `refusal`, `timeout` and `rate_limited` scenarios need `AI_MOCK_SCENARIO` set on the server, which is outside the one dev-server command I am allowed to run. They are covered by the route-seam tests in R3 (`app/api/summarize/route.test.ts`, "output and failure guards (D5, D7)"), which call the real `POST` handler. Live mode N/A (never run by the verifier; costs money).

## Week 6 spec checks

1. One AI feature only: **PASS**. The diff adds guards around the single summarize call in `app/api/summarize/route.ts`; no new AI feature or route.
2. Back end only: **PASS**. The SDK is imported only in `lib/liveAiClient.ts`, `lib/mockAiClient.ts`, `lib/aiFailure.ts` (server modules used by the route); `Dashboard.tsx` (`"use client"`) imports only `type ThreatLabel` from `lib/outputGuard.ts`, which is erased at compile time, and calls only `fetch("/api/summarize")`.
3. Secret key: **PASS**. `lib/liveAiClient.ts` reads `process.env.ANTHROPIC_API_KEY` only; the route logs only `failure.code` + `failure.logDetail` (numbers/short strings) and never the error object; the only `sk-ant-` string in the repo is the obvious test placeholder at `app/api/summarize/route.test.ts:148`.
4. System prompt in code: **PASS**. `lib/prompt.ts` is not in the diff (wording untouched); its 7 parts cover role/audience (`role`), task (`task`), untrusted `<log_excerpt>` (`untrustedData`), never add facts (`neverAddFacts`), unknown when unsure (`ifUnsure`), defender framing (`defenderFraming`), and format with two fields, four labels, 3 sentences / 600 chars, no markdown or HTML (`format`).
5. Guardrail, bad input: **PASS**. Route runs `checkExcerpt` before the AI call; runtime curls above returned 400 for empty, oversized, non-Cowrie and non-JSON bodies.
6. Guardrail, bad output: **PASS**. `lib/outputGuard.ts` `checkAiReply` rejects refusal, invalid JSON and Zod failures (summary trimmed 1 to 600 chars, at most 3 sentences; label one of four); route returns 502 `BAD_OUTPUT_MESSAGE` before anything is shown.
7. Guardrail, failure: **PASS**. Route wraps the AI call in try/catch; `lib/aiFailure.ts` `mapAiError` returns fixed messages and a `logDetail` of status or elapsed ms only; `lib/aiFailure.test.ts` checks raw text, headers and stack never appear; `lib/liveAiClient.ts` keeps 8,000 ms / 0 retries.
8. Cost awareness: **PASS**. 4,000-char cap still enforced (runtime 400 above); cost note and measured `costUsd` unchanged from #5/#9 follow-up; `max_tokens` 2,048 caps output.
9. Rate limit: **N/A**. Ticket #12.
10. Local and clean repo: **PASS**. No real-looking key in the diff or new files (grep for `sk-ant-` with 20+ trailing chars matched only the test placeholder); `.env.local` exists but is not in `git status` and `.gitignore` has `.env*` with `!.env.example`; lock-file diff is only `zod` moving to a direct dependency.
11. Fixture clean: **N/A**. `fixtures/sample-session.jsonl` is not new or changed in this ticket (not in `git status`); its existing test still passes in R3.
12. Rate limit key not client controlled: **N/A**. No limiter yet (#12); grep of `app/` and `lib/` finds no `x-forwarded-for`, `x-real-ip`, `client-ip` or `x-nf-client` reads.

## Ticket #10 acceptance boxes

Output guard + threat badge
- **PASS** Zod schema: `lib/outputGuard.ts` `SummarySchema` = `summary` string trim, min 1, max 600, `countSentences <= 3`; `threatLabel` `z.enum(["low","medium","high","unknown"])`.
- **PASS** Invalid JSON / missing field / bad label / empty or long summary / refusal → 502 "Couldn't produce a reliable summary for this excerpt." and `console.error("ai_bad_output", { reason })`: route lines 43 to 46; each case in `lib/outputGuard.test.ts`.
- **PASS** `bad_output` (label "none") and `refusal` (stopReason "refusal") mock scenarios exist in `lib/mockAiClient.ts`; route-seam test expects 502 + fallback for both.
- **PASS** Badge colors: `.threatLow` success (green), `.threatMedium` warn (amber), `.threatHigh` danger (red), new `.threatUnknown` uses `var(--muted)`; `THREAT_BADGE.unknown.text` = "Unknown" → "Threat: Unknown".
- **PASS** Failure state: `Dashboard.tsx` sets `aiFailure` (red `alertFail`, `role="alert"`) without calling `setResult(null)` or touching `excerpt`, so the previous summary and text stay (code reading; no DOM test in the repo).
- **PASS** Route-seam tests cover `bad_output`, `refusal` and a schema-valid `success` (`route.test.ts`, new describe block).

Failure guard
- **PASS** Timeout: `APIConnectionTimeoutError` → 504, `ai_timeout` `{ elapsedMs }`, TIMEOUT_MESSAGE matches D7 text; live client 8,000 ms, 0 retries.
- **PASS** Provider 429 → 503 "The AI service is busy. Try again in a minute.", `ai_rate_limited` `{ status: 429 }`.
- **PASS** 5xx (500, 529) and connection error → `ai_unavailable` with status or "none", timeout message (`lib/aiFailure.test.ts`).
- **PASS** 401/403 → `ai_auth_error` `{ status }` only, timeout message; test error carries an `x-api-key` header and raw text, neither appears in the mapped failure.
- **PASS** Error bodies are `{ error: <fixed message> }` only; route-seam test checks body and log for the fake key, provider text, request id, "stack" and "Error".
- **PASS** After failure: text box, previous summary, sample button and upload are untouched; the three buttons disable only while `isLoading`.
- **PASS** "Nothing was charged" not present in `app/` or `lib/` or the served page.
- **PASS** `timeout` and `rate_limited` mock scenarios throw the SDK's own error classes; route-seam tests cover both with leak checks.
- **PASS** Evidence available to Joseph: the on-screen failure messages and states now exist for him to describe (agents did not write `EVIDENCE.md`; it is not in the diff).

## End-to-end validation (boundaries)

- Source data: **PASS**. Fixture unchanged; `fixtures/sample-session.test.ts` passes in R3.
- Input: **PASS**. Server-side `checkExcerpt` before the AI call (runtime 400s above).
- Secret key: **PASS**. Env only, lazily read on the server, never logged or returned.
- System prompt: **PASS**. In `lib/prompt.ts`, server only, not from user input, unchanged.
- AI output schema: **PASS**. `checkAiReply` (Zod) gates every reply, mock and live alike.
- API failures: **PASS**. try/catch + `mapAiError`; 504/503 with fixed messages; short log codes.
- Display: **PASS**. `{result.summary}` rendered as React text (no `dangerouslySetInnerHTML`); badge class looked up from the validated four-label enum.

## Prompt injection note

**PASS**. `buildUserMessage` still wraps the excerpt in `<log_excerpt>` and neutralizes any `log_excerpt` tags inside it; prompt rule `untrustedData` marks the contents as untrusted. New this ticket: the Zod check is the backstop (D14), so even a redirected model can only return a 1 to 600 char, at most 3-sentence summary and one of four labels; an out-of-set label like "none" (the `bad_output` scenario) gets the fallback. The log `reason` names only field + rule, never reply text (`outputGuard.test.ts` "never puts reply text in the log reason").

## Housekeeping

- **PASS** `git status` untracked list (`lib/aiFailure.ts`, `lib/aiFailure.test.ts`, `lib/outputGuard.ts`, `lib/outputGuard.test.ts`) matches the Session state "New (untracked) files" list; changed-file list matches too.
- **PASS** `.env.local` present on disk, ignored by `.env*`, not in the untracked list. I read only its variable names, not values.

## Advisory only (not FAILs)

- `countSentences` counts any `.`/`!`/`?` followed by whitespace, so abbreviations ("e.g. ", "approx. ") or a quoted command ending in a period can push a valid 3-sentence summary to 4 and show the fallback. Worth watching in Joseph's live runs for C9.
- HTTP 503 for auth/unavailable and the browser-only message "Couldn't reach the server. Your log text is still here; try again in a moment." are builder choices (D7 sets only the messages); Joseph to confirm wording.
- No DOM/component tests, so the failure-state UI is verified by code reading only; worth one manual check in the browser with `AI_MOCK_SCENARIO=timeout`.
- Session state "Git: commits so far" line does not list 809e57b (#9) or acea1da (cost-note follow-up).
- Production build not run (not allowed for the verifier).

## Must fix before commit

None. 0 FAIL items.

── REVIEW DONE: 40 PASS / 0 FAIL ──
