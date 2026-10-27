# REVIEW: Ticket #12 follow-up (429 fallback via `readRetryAfter`, 300 s cap)

Reviewer: verifier subagent, fresh context, Oct 27 2026. Scope: uncommitted changes since 7290f90.
Evidence comes only from `git status`, `git diff`, files read in full, and commands run by the verifier.

**Result: 40 PASS / 0 FAIL / 1 N/A. Runtime checks R1 to R6 all green.**

## Scope (from git status, not from Session state)

- Modified: `.claude/progress.txt`, `CLAUDE.md`, `app/_components/Dashboard.tsx`, `lib/rateLimit.ts`
- Untracked (read in full): `lib/retryAfter.ts`, `lib/retryAfter.test.ts`
- Matches the Session state "#12 follow-up" bullet exactly. No mismatch.
- `.env.local` exists at the repo root, is covered by `.env*` in `.gitignore` (line 34), and is not in the untracked list.

## Runtime checks

| # | Check | Result | Output |
|---|---|---|---|
| R1 | `npm run typecheck` | PASS | `next typegen && tsc --noEmit`, "Types generated successfully", exit 0 |
| R2 | `npm run lint` | PASS | `eslint`, no output, exit 0 |
| R3 | `npm test` | PASS | Test Files 11 passed (11), Tests 161 passed (161) |
| R4 | Mock dev server, 127.0.0.1:3100 | PASS | "Next.js 16.4.3 (Turbopack)", "Ready in 205ms"; `GET /` returned 200 on the first poll |
| R5 | Routes | PASS | See below |
| R6 | Stop server | PASS | `lsof -ti tcp:3100` gave 60284 (the server's own process); killed it (exit 143, SIGTERM); a second `lsof` returned nothing (exit 1), so the port is free |

R5 details:
- `GET /` → 200. The HTML contains "Mock AI", "Sample logs only", "Next.js on Netlify", "1 request / min" and the footer "Defensive learning project".
- `POST /api/summarize` `{"excerpt":"   "}` (sent first so it couldn't hit the limiter) → 400 `{"error":"Paste or upload a Cowrie log excerpt first."}`.
- `POST /api/summarize` with the sample payload → 200 `{"summary":"Mock reply: no AI model was called. ...","threatLabel":"medium","mode":"mock","usage":{"inputTokens":0,"outputTokens":0},"costUsd":0}`.
- The same sample POST about 3 s later, with a forged `x-forwarded-for: 198.51.100.7` → **429**, header `retry-after: 57`, body `{"error":"Only one summary per minute. Try again in about 57 seconds.","retryAfterSeconds":57}`.
- Server log: three lines of `rate_limit_key { ipHeaderPresent: false }`, then the request lines 400 / 200 / 429. No IP appears in the log, including the forged one.

## Joseph's extra check: 429 → `readRetryAfter` → amber alert → Summarize timer

| # | Step | Result | Evidence |
|---|---|---|---|
| X1 | A live 429 from the mock server | PASS | Second POST inside a minute: status 429, `Retry-After: 57`, body `retryAfterSeconds: 57`. Body and header agree, and the message matches `rateLimitMessage(57)`. |
| X2 | The 429 branch passes the body and header to `readRetryAfter` | PASS | `Dashboard.tsx:88-91`: `response.status === 429`, then `await response.json().catch(() => null)` (a non-JSON body becomes `null` instead of throwing), then `setRateLimit(readRetryAfter(body, response.headers.get("Retry-After")))`. |
| X3 | The result sets the state that renders `.alertRate` and disables Summarize | PASS | `rateLimit` state (`:56`) renders `<div className={styles.alert} {styles.alertRate}} role="status">{rateLimit.message}</div>` (`:257-261`); `.alertRate` exists in `app/page.module.css:339`. The Summarize button has `disabled={isLoading \|\| rateLimit !== null}` (`:211`). The previous `result` keeps rendering underneath (`:270`). |
| X4 | The timer clears it after `seconds` | PASS | `useEffect` on `[rateLimit]` (`:60-66`) runs `setTimeout(() => setRateLimit(null), rateLimit.seconds * 1000)` and clears that timer on cleanup. Setting `null` hides the alert and re-enables the button. Clear, sample load and upload don't touch `rateLimit` (`:105-141`). |
| X5 | The 300 s cap applies to every source | PASS | `lib/retryAfter.ts:30-33`: `Math.min(fromBody ?? fromHeader ?? DEFAULT_RETRY_AFTER_SECONDS, MAX_RETRY_AFTER_SECONDS)`. The cap wraps the whole fallback chain, so body, header and default are all capped. Tests cover a 99999 header, a 99999 body, 301 in the body, and exactly 300 kept. A header too large for a number becomes `Infinity`, fails `Number.isInteger`, and falls to 60 s. |

**Where this check stops:** the verifier has no browser. X1 is real HTTP. X2 to X5 are a code trace plus the `readRetryAfter` unit tests. No component or DOM test runs the Dashboard (the repo has no DOM test setup). **No one has seen the amber alert, the disabled button or the timer clearing it on screen yet.** Joseph should confirm it in a browser: press Summarize twice within a minute on the local dev server.

## Week 6 spec checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | One AI feature only | PASS | The diff adds no AI call or feature; `app/api/summarize/route.ts` is still the single summarizer. |
| 2 | Back end only | PASS | `getAiClient` is called only in `route.ts:62`. `Dashboard.tsx` imports `lib/retryAfter.ts`, which has no imports, and doesn't import `lib/rateLimit.ts` (`node:crypto`). Only the route and its test import it. |
| 3 | Secret key | PASS | The key is read only in `lib/liveAiClient.ts:23` (`process.env.ANTHROPIC_API_KEY`). There is no key in the diff or the new files. The only `sk-ant` strings are obvious fake test values in tests. |
| 4 | System prompt in code | PASS | `lib/prompt.ts` is unchanged by this diff, and its 7 parts cover D12 rules 1 to 7 (role, task, untrustedData, neverAddFacts, ifUnsure, defenderFraming, format). |
| 5 | Guardrail, bad input | PASS | A whitespace excerpt returned 400 before any AI call (R5). `checkExcerpt` runs before `takeRateLimit` (`route.ts:46-55`). |
| 6 | Guardrail, bad output | PASS | `checkAiReply` runs before the response is built (`route.ts:73-77`). Unchanged. |
| 7 | Guardrail, failure | PASS | The try/catch with `mapAiError` is unchanged (`route.ts:61-70`). On the browser side, a malformed 429 body no longer throws into the "Couldn't reach the server" path. |
| 8 | Cost awareness | PASS | The input-card cost note is present (`Dashboard.tsx:235-240`), and the mock response shows `usage` and `costUsd`. |
| 9 | Rate limit | PASS | A second POST within the minute returned 429 (R5 / X1). |
| 10 | Local and clean repo | PASS | It runs locally (R4/R5). `.env*` is ignored, and `.env.local` isn't in the untracked list. No secrets in the diff or new files. |
| 11 | Fixture clean | N/A | `fixtures/sample-session.jsonl` isn't new or changed in this diff. The fixture tests still pass in R3. |
| 12 | Rate-limit key not client controlled | PASS | `lib/rateLimit.ts:24-31` reads only `x-nf-client-connection-ip`. A missing header goes to `shared`, and the IP is SHA-256 hashed with a salt. A forged `x-forwarded-for` still got 429 (R5), and the log shows only `ipHeaderPresent`. The diff changes only the re-export of `rateLimitMessage`. |

## Ticket #12 acceptance boxes (re-checked against the current tree)

| Box | Result | Evidence |
|---|---|---|
| Limiter in the route handler, not edge middleware | PASS | `route.ts:32-55`; there is no `middleware.ts` or `proxy.ts` at the repo root or one level down. |
| Key is a hash of `x-nf-client-connection-ip`; missing → shared bucket; raw IP never stored or logged | PASS | `rateLimit.ts:24-31`; the server log shows only the boolean. |
| Key never reads forwarding headers, body, query or cookies | PASS | grep finds `x-forwarded-for`, `client-ip` and `x-real-ip` only in comments and tests; there is no `cookies` or `searchParams` in `app/` or `lib/`. |
| Limiter checked first; the minute is used only at the AI call | PASS | `route.ts:34` check, `:46` input guard, `:52` take. R5's 400 didn't block the following 200. |
| 429 with `retryAfterSeconds`; UI message; button disabled until the wait is over | PASS | R5 body and header; X2 to X4. The message text comes from the shared `rateLimitMessage`. |
| One `ipHeaderPresent` boolean is logged | PASS | `route.ts:33`; the server log has `rate_limit_key { ipHeaderPresent: false }`. |
| Test-only reset | PASS | `resetRateLimit` at `rateLimit.ts:68-70`. |
| Route-seam tests (same IP twice, forged headers, separate IPs, shared bucket, input rejection doesn't count) | PASS | Present in `route.test.ts` (forged-header cases at lines 244-267); 161/161 pass. |
| README states the in-memory, per-instance limitation | PASS | `README.md:31` "Rate limit (known limitation)". |

## End-to-end boundaries

| Boundary | Result | Evidence |
|---|---|---|
| Source data | PASS | The fixture is unchanged and its rule tests pass (R3). |
| Input | PASS | 400 on a whitespace excerpt (R5). |
| Secret key | PASS | Env only, server only; nothing in the diff. |
| System prompt | PASS | `lib/prompt.ts` is unchanged, all 7 rules present. |
| AI output schema | PASS | `checkAiReply` runs before display; the mock reply passed through it (R5 200). |
| API failures | PASS | Server `mapAiError` is unchanged; the client 429 read now survives a bad body. |
| Display | PASS | The summary renders as a React text child; the 429 message is a text child of `.alertRate`. |

## Prompt injection

PASS. `buildUserMessage` wraps the excerpt in `<log_excerpt>` tags and `neutralizeExcerptTags` escapes any embedded `log_excerpt` tags (`lib/prompt.ts:38-48`). The `untrustedData` rule marks the tag contents as data. This diff doesn't change any of it.

## Advisory (not FAIL, no action required)

- The Session state bullets "Changed files this ticket (#12)" and "New (untracked) files this ticket (#12)" still list the original #12 files. The correct follow-up list is in the "#12 follow-up" bullet. Tidy it if you like.
- The 429 path's fallback (bad body → header → 60 s) is unit-tested in `readRetryAfter` only. No test renders the Dashboard, so the wiring in X2 to X4 is proven by reading the code, not by running it.

## Must fix before commit

None.

── REVIEW DONE: 40 PASS / 0 FAIL ──
