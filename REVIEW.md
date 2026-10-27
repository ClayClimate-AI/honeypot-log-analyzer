# REVIEW: Ticket #12 (rate limit)

Verifier subagent, Oct 27 2026. Evidence was gathered independently from `git status`, `git diff`, full reads of new files, and runtime checks R1 to R6. The builder's summary was not relied on.

**Result: ready to commit. R1 to R6 are green. 33 PASS / 0 FAIL (1 boundary and check 11 N/A).**

## Scope seen

- `git status`: modified `.claude/progress.txt`, `CLAUDE.md`, `README.md`, `app/_components/Dashboard.tsx`, `app/api/summarize/route.test.ts`, `app/api/summarize/route.ts`, `app/page.module.css`. Untracked: `lib/rateLimit.ts`, `lib/rateLimit.test.ts`. This matches the Session state lists exactly.
- `CLAUDE.md` hunks are only in section 10 (Session state). `EVIDENCE.md`, `lib/prompt.ts` and `fixtures/` are unchanged.
- `.gitignore` has `.env*` / `!.env.example`. `git status --ignored` reports `.env.local` as ignored (`!!`), and it is not in the untracked list.

## Runtime checks

| # | Check | Result | Output |
|---|---|---|---|
| R1 | `npm run typecheck` | PASS | `next typegen && tsc --noEmit`, "Types generated successfully", exit 0 |
| R2 | `npm run lint` | PASS | `eslint`, no output, exit 0 |
| R3 | `npm test` | PASS | `Test Files 10 passed (10)`, `Tests 142 passed (142)`, exit 0 |
| R4 | Dev server `AI_MODE=mock`, 127.0.0.1:3100 | PASS | "Ready in 277ms", `GET / 200` on the first poll |
| R5 | Routes (see below) | PASS | All status codes and bodies matched the ticket and D6/D8 |
| R6 | Stop server | PASS | `lsof -ti tcp:3100` gave one PID, which was killed. A second `lsof` returned nothing (exit 1), so port 3100 is free. |

R5 detail (no connection-IP header unless stated, so these requests use the shared bucket):
1. `GET /` → 200. Page has the pills "Mock AI", "Sample logs only", "Next.js on Netlify", "1 request / min", and the cost note "Cap: 4,000 characters · about $0.0001–$0.0003 per call (Claude Haiku 5.5) · measured cost shown after each call".
2. `POST /api/summarize` with the sample payload → 200, `{"summary":"Mock reply: ...","threatLabel":"medium","mode":"mock","usage":{"inputTokens":0,"outputTokens":0},"costUsd":0}`.
3. The same POST again → 429, `retry-after: 56`, `{"error":"Only one summary per minute. Try again in about 56 seconds.","retryAfterSeconds":56}`.
4. POST with forged `x-forwarded-for`, `x-real-ip`, `client-ip`, `forwarded` and `cookie` → 429 (still the shared bucket).
5. POST with an IP in the query string and in the body → 429 (still the shared bucket).
6. `x-nf-client-connection-ip: 198.51.100.50` with a whitespace excerpt → 400 "Paste or upload a Cowrie log excerpt first."; a non-Cowrie excerpt → 400 "This doesn't look like Cowrie JSON log output."; then a valid excerpt → 200 mock. The two input rejections did not use up the minute, and this IP got its own bucket.
7. The same IP again, plus a forged `x-forwarded-for` → 429.
8. `x-nf-client-connection-ip: 198.51.100.51` with 4,001 chars → 400 "That excerpt is 4,001 characters. The limit is 4,000, so trim it and try again."
9. The server log showed only `rate_limit_key { ipHeaderPresent: false|true }`. No connection IP appeared in app log lines. The query string appeared only in Next's own dev request line, which comes from my test URL and not from app code.

## Week 6 spec checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | One AI feature only | PASS | The diff adds only a limiter around the existing summarize call. There is no new AI call. |
| 2 | Back end only | PASS | The SDK/key are referenced only in `lib/liveAiClient.ts`, `lib/aiFailure.ts`, `lib/mockAiClient.ts` and server code. `Dashboard.tsx` only `fetch`es `/api/summarize`. |
| 3 | Secret key | PASS | There is no key in the diff or the new files. The only key-like string is the pre-existing placeholder `FAKE_KEY` test constant (`route.test.ts:151`). `.env.local` is ignored. |
| 4 | System prompt in code | PASS | `lib/prompt.ts` is unchanged this ticket. `SYSTEM_PROMPT_PARTS` covers all 7 D12 rules: role, task, untrustedData, neverAddFacts, ifUnsure, defenderFraming, format. |
| 5 | Guardrail, bad input | PASS | `route.ts` runs `checkExcerpt` before `takeRateLimit` and the AI call. R5 items 6 and 8 returned 400. |
| 6 | Guardrail, bad output | PASS | `route.ts:73-77` runs `checkAiReply` (Zod) before the response. A failure returns 502 with `BAD_OUTPUT_MESSAGE`. |
| 7 | Guardrail, failure | PASS | `route.ts:61-70` wraps the AI call in try/catch with `mapAiError`, and logs only `code` and `logDetail`. The route test "a failed AI call still uses up the minute" passes. |
| 8 | Cost awareness | PASS | The 4,000 cap is enforced (R5 item 8) and the cost note is visible on `/` (R5 item 1). |
| 9 | Rate limit | PASS | R5 item 3: a second request inside a minute → 429 with `retryAfterSeconds` and `Retry-After`. |
| 10 | Local and clean repo | PASS | It runs locally (R4/R5). There is no secret in `git diff`, `lib/rateLimit.ts` or `lib/rateLimit.test.ts`. |
| 11 | Fixture clean | N/A | `fixtures/sample-session.jsonl` was not changed this ticket. |
| 12 | Rate-limit key not client controlled | PASS | `lib/rateLimit.ts:25` reads only `x-nf-client-connection-ip`. A missing or blank header → `"shared"`. The key is `ip:` + SHA-256 (salt + IP). The only log line is a boolean (`route.ts:33`). A grep of non-test `app/` and `lib/` finds no read of `x-forwarded-for`, `x-real-ip`, `client-ip`, `forwarded`, cookies or `searchParams`. R5 items 4, 5 and 7 confirm it at runtime. |

## Ticket #12 acceptance boxes

| Box | Result | Evidence |
|---|---|---|
| Limiter in the route handler, not edge middleware | PASS | Called from `app/api/summarize/route.ts:32-55`. There is no `middleware.ts` in the diff or the untracked files. |
| Key = hash of the connection IP; missing → shared; raw IP never stored or logged | PASS | `clientKey` in `lib/rateLimit.ts:24-31`. The map stores only the hashed key. The log is the boolean only (R5 item 9, route test "logs only whether..."). |
| Never reads forwarding headers, body, query or cookies | PASS | See check 12. |
| Checked first; minute used only on reaching the AI call | PASS | `checkRateLimit` (line 34) → `checkExcerpt` → `takeRateLimit` (line 52) → AI call. R5 item 6. |
| 429 + `retryAfterSeconds`; UI message; button disabled until the wait ends | PASS | `tooManyRequests` in `route.ts:16-21`. In `Dashboard.tsx`, `setRateLimit` shows the server's message in `.alertRate`, `disabled={isLoading \|\| rateLimit !== null}`, and a `useEffect` timer clears it after `seconds`. |
| Route logs one `ipHeaderPresent` boolean | PASS | `route.ts:33`. Seen in the server log (R5 item 9). |
| Limiter has a test-only reset | PASS | `resetRateLimit` in `lib/rateLimit.ts:68-70`, called in every route `beforeEach`. |
| Route-seam tests cover the 5 cases | PASS | `route.test.ts` "rate limit (D8)" covers the same IP twice → 429, forged forwarding headers, different IPs, no header → shared, and input rejection doesn't count. It also has a failed-AI-call test and a log test. All pass in R3. |
| README states the in-memory, per-instance limitation and the spend-limit backstop | PASS | `README.md` has a new "Rate limit (known limitation)" section with both points. |

## End-to-end boundaries

| Boundary | Result | Evidence |
|---|---|---|
| Source data | N/A | The fixture was not changed this ticket (verified in #9). |
| Input | PASS | The server-side `checkExcerpt` runs before the minute is used. R5 items 6 and 8. |
| Secret key | PASS | Key only from env in `lib/liveAiClient.ts`. `.env.local` is ignored. There is no key in the diff. |
| System prompt | PASS | `lib/prompt.ts` is unchanged and contains all 7 rules. |
| AI output schema | PASS | `checkAiReply` sits between the AI reply and `Response.json` (`route.ts:73`). |
| API failures | PASS | try/catch + `mapAiError`. Only codes are logged. A failed call still uses up the minute, as in the D8 wording "reaches the AI call". |
| Display | PASS | The 429 message renders as text in a `role="status"` div. The previous summary stays, and the Ready alert is hidden while the limit is active. |

## Prompt injection

PASS. `buildUserMessage` still wraps the excerpt in `<log_excerpt>` after `neutralizeExcerptTags`. System prompt rule `untrustedData` marks the tag contents as untrusted. This ticket does not touch that path.

## Advisory (not FAILs, no action required)

- `Dashboard.tsx:88`: the 429 branch calls `response.json()` without `.catch`, and it does not check that `retryAfterSeconds` is a number. A 429 from somewhere other than the route (for example a platform limit with a non-JSON body) would land in the outer catch and show the network message. A JSON 429 without the field would clear at once. The page still works either way.
- Because the limiter runs before the body is parsed, a blocked client gets 429 even for empty input. This matches "the limiter is checked first".
- Local dev has no Netlify header, so all local requests share one bucket. As documented, whether Netlify really sends the header is proven only at deploy.

## Must fix before commit

None.
