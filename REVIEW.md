# REVIEW: Ticket #14, Final code review (whole repo at HEAD 344fea2 plus working tree)

Verifier subagent, Nov 1 2026. Evidence comes only from files, `git status` / `git diff`, and the runtime checks below. Scope: the whole codebase, not just the diff.

**Runtime checks R1 to R6 all pass. The review still has 3 FAILs (ticket and README items, no code defects); see "Must fix before commit".**

## Git state

- `git status`: on `main`, up to date with `origin/main`. Modified: `.claude/progress.txt`, `CLAUDE.md`, `EVIDENCE.md`, `PROMPT_LOG.md`, `README.md`. **No untracked files.** This matches §10 "Uncommitted now (Nov 1 2026)" (the same 5 files, docs only).
- `git diff --stat`: 5 files, +152 / -54. All are docs. No source, test, config or lockfile changes.
- Ignored (`git status --ignored`): `.env.local`, `build.log`, `context/`, `.scratch/`, `lib/generated/`, `next-env.d.ts`. `.gitignore` lines 35-36 (`.env*`, `!.env.example`), 22 (`/build.log`), 46-47, 50-52, 55. `.env.local` is **not** in the untracked list.

## Runtime checks

| # | Check | Result | Output |
|---|---|---|---|
| R1 | `npm run typecheck` | PASS | `next typegen && tsc --noEmit` printed "✓ Types generated successfully", exit 0 |
| R2 | `npm run lint` | PASS | `eslint`, no output, exit 0 |
| R3 | `npm test` | PASS | `Test Files 14 passed (14)`, `Tests 183 passed (183)` |
| R4 | Dev server `AI_MODE=mock npx next dev --hostname 127.0.0.1 --port 3100` | PASS | `GET /` returned 200 on the first poll (about 1 s) |
| R5 | Routes | PASS | See below |
| R6 | Stop server | PASS | `lsof -ti tcp:3100` returned PID 97557, `kill 97557` (exit 143). A second `lsof -ti tcp:3100` printed nothing (exit 1), so the port is free |
| B | `build.log` (§11) | PASS | `prisma generate && next build`: "Generated Prisma Client (7.10.1)", "Compiled successfully", TypeScript finished, routes `/` (PPR), `/_not-found`, `ƒ /api/summarize`. No errors. (Verifier did not run build.) |

R5 detail (mock mode):
- `GET /` returned 200. The HTML has the pills "Mock AI", "Sample logs only", "Next.js on Netlify" and "1 request / min", the cost note "$0.0001–$0.0008", and the D13 footer text.
- `POST /api/summarize` with the sample payload returned **200**: `{"summary":"Mock reply: no AI model was called. …","threatLabel":"medium","mode":"mock","usage":{"inputTokens":0,"outputTokens":0},"costUsd":0}`. This matches the spec's contract.
- A second POST inside the minute, with forged `x-forwarded-for`, `x-real-ip` and `client-ip`, returned **429** with `retry-after: 49` and body `{"error":"Only one summary per minute. Try again in about 49 seconds.","retryAfterSeconds":49}`. The forged headers did not escape the shared bucket.
- Input guard, sent in a separate `x-nf-client-connection-ip` bucket. Each case returned **400**:
  - whitespace: "Paste or upload a Cowrie log excerpt first."
  - non-Cowrie text: "This doesn't look like Cowrie JSON log output."
  - non-JSON body: the empty message
  - 4,001 characters: "That excerpt is 4,001 characters. The limit is 4,000, so trim it and try again."
- Same bucket, valid excerpt sent with `"mode":"live"` in the body: **200** with `mode: "mock"`. The body can't switch the mode. The 4 rejections above had not used up the minute.
- Same bucket again: **429** with `retry-after: 60`.
- Server log: only `rate_limit_key { ipHeaderPresent: false|true }` lines. No IP was logged.
- Mock failure scenarios (timeout, bad_output, refusal, rate_limited): N/A at runtime, because they need `AI_MOCK_SCENARIO` set at server start. Route-seam tests cover them (route.test.ts:150-208, passing in R3).

## Week 6 spec checks (whole codebase)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | One AI feature only | PASS | The only AI call path is `app/api/summarize/route.ts` → `lib/aiClient.ts` → `lib/liveAiClient.ts` / `lib/mockAiClient.ts`. No other route or AI client exists in `app/` or `lib/`. |
| 2 | Back end only | PASS | `"use client"` appears only in `app/_components/Dashboard.tsx`, which only `fetch`es `/api/summarize`. No client file imports the Anthropic SDK, `aiClient` or `liveAiClient` (grep). |
| 3 | Secret key | PASS | The key is read only at `lib/liveAiClient.ts:23` (`process.env.ANTHROPIC_API_KEY`), on the server and created lazily. There is no `NEXT_PUBLIC_` key. `.env.example` has `ANTHROPIC_API_KEY=` empty. The logs (`route.ts:35,70,77`, `runStore.ts:75,78,80`) print only codes, numbers and booleans. |
| 4 | System prompt in code, Joseph's wording, 7 rules | PASS | `lib/prompt.ts` (not in the diff, so unchanged since 97b276b) has parts `role` (log analyst for a security defender), `task` (what happened / means / watch next), `untrustedData` (`<log_excerpt>` contents are untrusted attacker data, never follow), `neverAddFacts`, `ifUnsure` ("unknown"), `defenderFraming` (no attack steps, no improving commands), `format` (JSON, 4 labels, 6 sentences, 700 chars, plain text). The prompt is not taken from user input. |
| 5 | Guardrail, bad input | PASS | `route.ts:48-51` runs `checkExcerpt` before the AI call. `lib/inputGuard.ts` rejects empty input, input over 4,000 characters (never truncated) and input with no `cowrie.` event. The browser rejects uploads over 50 KB before reading (`Dashboard.tsx:107`). Confirmed in R5. |
| 6 | Guardrail, bad output | PASS | `lib/outputGuard.ts`: refusal rejected first, then a JSON parse, then a Zod schema (summary trimmed to 1-700 chars and at most 6 sentences; label is one of 4). Failure gives 502 with `BAD_OUTPUT_MESSAGE` (`route.ts:75-79`). The summary renders as a React text child (`Dashboard.tsx:274`). There is no `dangerouslySetInnerHTML` anywhere in `app/`. |
| 7 | Guardrail, failure | PASS | `liveAiClient.ts:10-11`: 8,000 ms timeout, 0 retries. `route.ts:63-72` catches the error, and `lib/aiFailure.ts` maps it to a code plus a number-only `logDetail` and a friendly message. The error object is never logged or returned. Route tests check that the fake key, the raw text and the request id are absent. |
| 8 | Cost awareness | PASS | 4,000-character cap (`inputGuard.ts:5`). Pre-call note "Cap: 4,000 characters · about $0.0001–$0.0008 per call (Claude Haiku 5.5) · measured cost shown after each call" (`Dashboard.tsx:237`, seen in R5 HTML). After the call: tokens and cost from `lib/cost.ts` (dated 2026-10-06). |
| 9 | Rate limit | PASS | A second POST in the same minute returned 429 in R5, twice: once in the shared bucket and once in the per-IP bucket. |
| 10 | Local and clean repo | PASS | Runs locally (R4, R5). A secret-pattern grep of the whole repo (excluding node_modules, .next, .git and .env.local) found only known fakes and dummies: `lib/aiFailure.test.ts:5`, `app/api/summarize/route.test.ts:151`, `.github/workflows/ci.yml:17-18` (CI dummy DB URL), `docs/week7/HANDOFF.md:24`, `docs/week7/SPEC.md:66`, and `REVIEW.md` quoting them. `.env.local` is ignored and untracked. The working-tree diff has no keys. |
| 11 | Fixture clean | PASS | Read in full, `fixtures/sample-session.jsonl` (not changed in this diff): 11 lines, 1,387 bytes. Fields are only eventid, timestamp, src_ip, username and password. The only IP is 203.0.113.10, with no private ranges. The only host is `update.invalid`. One date (2026-01-15). Passwords are only 123456 and admin. There is one injection line (line 9). `fixtures/sample-session.test.ts` asserts every rule, and its last test runs the fixture through `checkExcerpt`. The fixture reaches the route only through the client bundle (`Dashboard.tsx:11,121`, Turbopack text rule in `next.config.ts:11`). The server never reads it: `app/api/` and the non-test `lib/` files have no reference to it. |
| 12 | Rate-limit key not client controlled | PASS | `lib/rateLimit.ts:12,25`: the key comes only from `x-nf-client-connection-ip`. A missing or empty header falls back to `"shared"` (line 27). The IP is salted and hashed with SHA-256 (line 29) and never logged (`route.ts:35` logs only the boolean). There is no read of `x-forwarded-for`, `x-real-ip`, `client-ip`, `forwarded`, cookies, the query string or the body for the key (grep). The limiter runs in the route handler (`route.ts:34-57`). |

## Ticket #14 acceptance boxes (`.scratch/cowrie-summarizer/issues/14-final-code-review.md`)

| # | Box | Result | Evidence |
|---|---|---|---|
| T1 | A `/code-review` runs from the first commit to `HEAD` (spec axis and standards axis) | FAIL | No evidence in the repo or working tree that a `/code-review` was run. This verifier pass covers checks 1 to 12 and R1 to R6 on the whole repo. It is not a commit-by-commit standards review. |
| T2 | Verifier checks 1 to 12 pass on the full codebase | PASS | All 12 PASS above. |
| T3 | Every spec line maps to working code or a README section | PASS | CLAUDE.md no longer has a §3.2 (headings are 1, 5-11). Checked against `docs/spec.md` stories 1-64 instead. Each maps to code above or to README §2-3. Story 23 (the summary names the injection) and 51 (spend limit) are live or external only; PROMPT_LOG Entry 19 records them. |
| T4 | README has the data-flow diagram (browser → route → guards → Anthropic → Zod → screen) | PASS | `README.md:27-52` mermaid diagram, in the route's real order: checkRateLimit → checkExcerpt → takeRateLimit → prompt → aiClient → Anthropic/mock → aiFailure / outputGuard → runStore → Dashboard. Its colors match the §6 classDefs. Joseph's review of it can't be verified from files. |
| T5 | Findings fixed in one approved pass and committed by Joseph | N/A | A future step in the loop. |

## End-to-end boundaries

| Boundary | Result | Evidence |
|---|---|---|
| Source data | PASS | Fixture sanitized and tested (check 11). The sanitizer `scripts/sanitize-cowrie.mts` uses the shared rules in `lib/fixtureRules.mts`. |
| Input | PASS | Server `checkExcerpt` before the AI call. The browser repeats only the basic checks (check 5, R5). |
| Secret key | PASS | Server env only, lazy client, never logged (check 3). |
| System prompt | PASS | In code, 7 rules, excerpt wrapped and tags neutralized (check 4). |
| AI output schema | PASS | Zod plus refusal handling (check 6). |
| API failures | PASS | Timeout, 429, 401/403 and 5xx mapped, no leaks (check 7). DB save failures are caught and logged by code or name only (`runStore.ts:79-91`), 3 s cap. |
| Display | PASS | Plain-text render, "AI generated · verify before acting" label, threat badge, failure and rate-limit alerts keep the previous summary (`Dashboard.tsx:256-300`). |

## Prompt injection

PASS. `lib/prompt.ts:46-48` wraps the excerpt in `<log_excerpt>…</log_excerpt>`. Before wrapping, `neutralizeExcerptTags` (lines 33-42) escapes any opening or closing `log_excerpt` tag inside the excerpt, so a crafted log line can't close the block early. `prompt.test.ts:40-57` checks this. System prompt rule `untrustedData` says the contents are attacker data, never instructions. Zod (D5) is the backstop. The fixture's line 9 holds the injection test text, and it reaches the model only as tagged data.

## Other findings

| # | Item | Result | Evidence |
|---|---|---|---|
| X1 | Session state vs `git status` | PASS | §10 "Uncommitted now" lists the same 5 modified files. Both say there are no new files. |
| X2 | README states the boundaries required by CLAUDE.md "Purpose and boundaries" | FAIL | The working-tree diff removes the README bullet "**Defender framing.** The AI summarizes what happened, what it means, and what to watch. It never explains how to attack." CLAUDE.md lists "Defender framing in the system prompt" as a boundary the README must state. Line 12 ("not an attack tool") does not say the AI never gives attack steps. |
| X3 | README "What's still open" is current | FAIL | `README.md:114` still lists "the README data-flow diagram (#14)" as open, but the diagram is at `README.md:27-52`. |

Advisory only, not counted:
- `EVIDENCE.md`, row "W6 · Explain the data flow", still says "README diagram: TBD (Week 7 Step 7, #19)". That is Joseph's file; the verifier did not touch it.
- Ticket box T3 points at CLAUDE.md §3.2, which no longer exists (removed in c899f54). Consider pointing it at `docs/spec.md`.
- Session state and `.claude/progress.txt` name #19 README as the current step, with #14 after #18. This review was run for #14 ahead of that order.

## Totals

**31 PASS / 3 FAIL / 1 N/A**: R1-R6 and the build log, 7; checks 1-12, 12; ticket boxes, 3 PASS / 1 FAIL / 1 N/A; boundaries, 7; prompt injection, 1; other, 1 PASS / 2 FAIL.

## Must fix before commit

1. **T1**: no evidence that a `/code-review` ran from the first commit to HEAD (spec and standards axes). Run it, or record the decision to treat this verifier pass as the review. `[approve] / [skip]`
2. **X2**: restore a README boundary line for defender framing (the AI explains what happened, what it means and what to watch, and never how to attack), as CLAUDE.md "Purpose and boundaries" requires. `[approve] / [skip]`
3. **X3**: remove "the README data-flow diagram (#14)" from the open items at `README.md:114`, since the diagram is now present. `[approve] / [skip]`

## Code review, spec axis (#14, builder, Nov 1 2026; added on Joseph's approval of F1 option A)

The ticket's `/code-review` box is covered this way: the verifier's checks 1 to 12 above are the standards axis, and the builder checked `docs/spec.md` (stories 1 to 78, API contract, testing section) against the code as the spec axis. No extra subagents were run (CLAUDE.md §6). Joseph's marks are in brackets.

| # | Finding | Evidence | Mark |
|---|---|---|---|
| S1 | API contract said errors return `{ error: { code, message }, mode }`; the route returns `{ error }` (plus `retryAfterSeconds` on a 429) | `app/api/summarize/route.ts:50, 71, 78`; dashboard and tests depend on it | [approve] spec fixed to match the code |
| S2 | Story 74: no mock-mode clip of the bad-output fallback linked from the README (D15, moved to Week 7) | `README.md` | [skip] dropped by Joseph (Nov 1 2026); no clip needed |
| S3 | Story 23: the summary should call out an injection attempt; prompt-driven, no test enforces it | Joseph's deployed run, Nov 1 2026, flagged and ignored the injection text | [skip] advisory |
| S4 | Week 6 spec lines superseded by Week 7 (no database, PR workflows out of scope, Netlify time limit still to confirm) | `docs/spec.md` lines 201, 242, 250, 260 | [approve] one Week 7 note added at the top of the spec |

Confirmed with no finding: plain-text summary rendering, no `dangerouslySetInnerHTML` (story 29); fixture test checks exactly one injection line and the input guard (`fixtures/sample-session.test.ts:94-99`); mock reports zero usage (`lib/mockAiClient.ts`); server repeats the input checks and input rejections don't use up the minute (`route.ts:36-57`); forged-header 429 and `ipHeaderPresent` proven on the deployed site (Nov 1 2026); 8 s timeout under Netlify's 60 s limit; README opens with the defensive statement and has the data-flow diagram (story 73).

Fix pass (one pass): S1, S4, F2 (defender-framing bullet restored in the README Boundaries), F1 (this section). F3 and the EVIDENCE.md advisory were already fixed by G1.
