# REVIEW.md: Ticket #8 (input guard + upload)

Verifier pass, Oct 26 2026. Every result here comes only from commands I ran myself (`git status`, `git diff`, R1 to R6, read-only `find`/`grep`) and from files I read: `lib/inputGuard.ts` and `lib/inputGuard.test.ts` (new, read in full), the `git diff` of `app/api/summarize/route.ts`, `app/api/summarize/route.test.ts`, `app/_components/Dashboard.tsx`, `app/page.module.css`, `CLAUDE.md`, `.claude/progress.txt`, plus `lib/prompt.ts`, `lib/liveAiClient.ts`, `.gitignore` and the ticket file `.scratch/cowrie-summarizer/issues/08-input-guard-and-upload.md`.

**Result: 27 PASS / 0 FAIL.** Runtime checks R1 to R6 all passed.

## Runtime checks

| # | Check | Result | Output |
|---|---|---|---|
| R1 | `npm run typecheck` | PASS | `next typegen && tsc --noEmit` → "Types generated successfully", exit 0 |
| R2 | `npm run lint` | PASS | `eslint`, no output, exit 0 |
| R3 | `npm test` | PASS | Vitest 5.0.5: `Test Files 5 passed (5)`, `Tests 39 passed (39)` |
| R4 | Dev server `AI_MODE=mock npx next dev --hostname 127.0.0.1 --port 3100` | PASS | `GET /` returned 200 within 1 s of polling |
| R5 | Routes (results below) | PASS | Every status and body matches the ticket and D6 |
| R6 | Stop server | PASS | `lsof -ti tcp:3100` → one PID, killed only that PID (exit 143 = SIGTERM); a second `lsof -ti tcp:3100` returned nothing (exit 1), so the port is free |

R5 detail:
- `GET /` → 200. Page HTML contains "Mock AI", "Or upload a file", "up to 50 KB", and the cost note "Cap: **4,000** characters · about **$0.0003** per call (Claude Haiku 5.5)".
- `POST /api/summarize` with the sample Cowrie payload → 200, `{"summary":"Mock reply: no AI model was called. …","threatLabel":"medium","mode":"mock","usage":{"inputTokens":0,"outputTokens":0},"costUsd":0}`.
- `POST` `{"excerpt":"   "}` → 400 `{"error":"Paste or upload a Cowrie log excerpt first."}`.
- `POST` `{"excerpt":"please summarize my grocery list"}` → 400 `{"error":"This doesn't look like Cowrie JSON log output."}`.
- `POST` with 4,001 `a` characters → 400 `{"error":"That excerpt is 4,001 characters. The limit is 4,000, so trim it and try again."}`.
- `POST` body `not json` → 400 `{"error":"Paste or upload a Cowrie log excerpt first."}` (this used to be a 500).

## Repo state

| # | Check | Result | Evidence |
|---|---|---|---|
| G1 | `git status` matches Session state | PASS | The untracked files are exactly `lib/inputGuard.ts` and `lib/inputGuard.test.ts`, and the modified files are exactly the six listed in CLAUDE.md section 10 for #8. They match. |
| G2 | `.env.local` is ignored | PASS | `.env.local` exists at the repo root but is not in the untracked list. `.gitignore` line 34 `.env*` covers it, and line 35 `!.env.example` lets only the example file through. |

## Week 6 spec checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | One AI feature only | PASS | The diff adds input checks and an upload box to the existing summarizer. There is still one AI call path (`route.ts` → `getAiClient`). |
| 2 | Back end only | PASS | `Dashboard.tsx` only calls `fetch("/api/summarize")`. It imports `lib/inputGuard`, which is pure checks with no SDK and no env. The Anthropic SDK is used only in `lib/liveAiClient.ts`. |
| 3 | Secret key | PASS | A grep of `app/` and `lib/` finds no `sk-ant`, no `console.log` or `console.error`, and `ANTHROPIC_API_KEY` only in `lib/liveAiClient.ts:23` (`process.env`). The new files never touch the key. |
| 4 | System prompt in code, Joseph's wording, 7 rules | PASS | `lib/prompt.ts` is not in the diff, so the wording is unchanged. `SYSTEM_PROMPT_PARTS` covers role, task, untrustedData (`<log_excerpt>`), neverAddFacts, ifUnsure (`unknown`), defenderFraming, and format (two fields, four labels, 3 sentences, 600 chars, no markdown or HTML). |
| 5 | Guardrail: bad input | PASS | `route.ts` runs `checkExcerpt` before `getAiClient` and returns a 400 for empty, over 4,000 characters (never truncated) and non-Cowrie input. Route tests assert `getLastMockRequest()` is null, and R5 confirmed all three live. |
| 6 | Guardrail: bad output | N/A | Zod output check is #10. `route.ts:30` still does a bare `JSON.parse(reply.text)`. |
| 7 | Guardrail: failure | N/A | Timeout and error mapping is #10. The live client already has an 8,000 ms timeout and 0 retries, but there is no try/catch in the route yet. |
| 8 | Cost awareness | PASS | `MAX_EXCERPT_CHARS = 4000` in `lib/inputGuard.ts` is enforced on the server. The cost note is visible in the page HTML (R5). |
| 9 | Rate limit | N/A | This is #12. No limiter exists yet. |
| 10 | Local and clean repo | PASS | The app runs locally (R4/R5). No key pattern appears in the diff or the two new files, and `.env.local` is ignored (G2). |
| 11 | Fixture clean | N/A | `fixtures/` does not exist (`find` returned "No such file or directory"). The fixture is #9. |
| 12 | Rate-limit key not client controlled | N/A | No limiter yet (#12). A grep finds no `x-forwarded-for` or other IP header read anywhere in `app/` or `lib/`. |

## Ticket #8 acceptance boxes

| Box | Result | Evidence |
|---|---|---|
| Empty or whitespace returns 400 "Paste or upload a Cowrie log excerpt first." | PASS | `EMPTY_MESSAGE` in `inputGuard.ts:8`. The route test covers both cases, and R5 got 400 with that exact text. |
| Over 4,000 returns 400 with the actual count, never truncated | PASS | `tooLongMessage(excerpt.length)` uses the real length. The route rejects and does not slice. R5 showed "4,001 characters". A test also confirms an excerpt of exactly 4,000 reaches the mock unchanged. |
| No Cowrie event line returns 400 "This doesn't look like Cowrie JSON log output." | PASS | `isCowrieEvent` needs a non-array JSON object with a string `eventid` starting `cowrie.`. Tests cover the rejections (arrays, null, non-string eventid, `not.cowrie.`, split lines), and R5 confirmed the 400. |
| Browser repeats empty and length checks; server checks again | PASS | `handleSummarize` in `Dashboard.tsx` calls `checkExcerptBasics` before `fetch`. The route independently runs the full `checkExcerpt`. |
| Upload over 50 KB rejected before read; accepted upload fills the box and takes the paste path | PASS | `loadFile` checks `file.size > MAX_UPLOAD_BYTES` (51,200) before `file.text()`. An accepted file only calls `setExcerpt`, so it goes through the same Summarize → POST → guard path. |
| Route-seam tests cover empty, whitespace, 4,001 and non-Cowrie, with exact messages and no AI call | PASS | The `it.each` in `route.test.ts` asserts the 400, `toEqual({ error: message })`, and `getLastMockRequest()` null for all four. |
| Evidence available to Joseph (what he capped and why; which guards and what they caught) | PASS | The cap and the three input guards are in place and can be shown on screen and with curl. Joseph writes the evidence himself. EVIDENCE.md was not touched, since it is not in the diff. |

## End-to-end boundaries

| Boundary | Result | Evidence |
|---|---|---|
| Source data | N/A | There is no fixture yet (#9). |
| Input | PASS | The server-side `checkExcerpt` decision is final, and the browser repeats the check for fast feedback. |
| Secret key | PASS | See check 3. |
| System prompt | PASS | See check 4. It is unchanged in this ticket. |
| AI output schema | N/A | Comes in #10. |
| API failures | N/A | Comes in #10. |
| Display | PASS | `{inputError}` is rendered as a React text child inside `role="alert"`, not as HTML. A failed call keeps the previous result on screen. |

## Prompt injection note

| Check | Result | Evidence |
|---|---|---|
| Log content treated as data | PASS | `buildUserMessage` still wraps the excerpt in `<log_excerpt>` tags after `neutralizeExcerptTags`, and the system prompt's `untrustedData` rule marks the tag contents as untrusted. The new input guard does not change the excerpt bytes (the test asserts the exact wrapped message). |

## Advisory (not FAILs; no action required)

- `route.ts` runs `request.json()` on the whole body before the 4,000-character check, so a very large body is fully read and parsed before it is rejected. It is still rejected before the AI call. If wanted, a later ticket could check `content-length` first.
- In `Dashboard.tsx`, `loadFile` does `void loadFile(file)` with no catch around `file.text()`. A read error would become an unhandled rejection rather than a message on screen. Worth a look in #10 with the other failure states.
- The builder chose the wording for the length and upload messages. D6 fixes only the empty and non-Cowrie text. Joseph may want to confirm he is happy with it.

## Must fix before commit

None. R1 to R6 all passed, and no check failed.
