# REVIEW.md: Ticket #3 (mock tracer bullet)

Verifier pass, Oct 25 2026. Every result below comes from commands I ran myself (`git status`, `git diff`, the R1 to R6 runtime checks) and from reading the files in full. I did not rely on the builder's summary or the Session state.

**Result: 18 PASS / 1 FAIL.** All runtime checks R1 to R6 are green. The one FAIL is about paperwork (the Session state file list), not code.

## Evidence gathered

- `git status` (branch `main`, up to date with origin). Modified: `.claude/agents/verifier.md`, `.claude/progress.txt`, `CLAUDE.md`, `REVIEW.md`, `app/globals.css`, `app/layout.tsx`, `app/page.module.css`, `app/page.tsx`. Untracked: `app/_components/` (`Dashboard.tsx`, `Footer.tsx`, `Header.tsx`), `app/api/` (`summarize/route.ts`, `summarize/route.test.ts`), `lib/aiClient.ts`, `lib/mockAiClient.ts`.
- Read in full: all 7 untracked files, `app/page.module.css`, `lib/aiMode.ts`, `.gitignore`, `docs/spec.md` (API contract), and the ticket file `.scratch/cowrie-summarizer/issues/03-mock-tracer-bullet.md`. I read the `git diff` for every other tracked change.
- `.gitignore` has `.env*` with `!.env.example`, plus `/.next/`, `/context/`, `/.scratch/`, and `.claude/*` with exceptions for `progress.txt` and `agents/`. `.env.local` is not in the untracked list.
- Process note: besides the allowed commands, I ran `find` to list the new directories, piped one `curl` through `grep`/`sort`/`uniq` to pull text out of the page, and used `lsof` and `kill` to find and stop the dev server I started (R6). All of these only read, except the `kill` on my own server.

## Runtime checks

| # | Check | Result | Output |
|---|---|---|---|
| R1 | `npm run typecheck` | PASS | `next typegen && tsc --noEmit`: "Types generated successfully", exit 0 |
| R2 | `npm run lint` | PASS | `eslint`, no output, exit 0 |
| R3 | `npm test` | PASS | Vitest 5.0.5: Test Files 2 passed (2), Tests 7 passed (7), exit 0 |
| R4 | `AI_MODE=mock npx next dev --port 3100` | PASS | "Next.js 16.4.3 (Turbopack) ... Ready in 248ms"; `GET /` returned 200 on the first poll (1 s) |
| R5 | Route exercises | PASS | See below |
| R6 | Stop the server, port free | PASS | Stopped PID 13435 (exit 143, SIGTERM); `lsof -ti tcp:3100 -sTCP:LISTEN` empty; `curl` to `localhost:3100` got connection refused (HTTP 000) |

R5 details:
- `GET /`: **200**. The HTML has "Mock AI", "Sample logs only", "Next.js on Netlify", "1 request / min", the D13 footer word for word, and the idle state "Waiting for input". No "Live AI".
- `POST /api/summarize` with the sample payload: **200**, body `{"summary":"Mock reply: no AI model was called. ...","threatLabel":"medium","mode":"mock","usage":{"inputTokens":0,"outputTokens":0},"costUsd":0}`. This matches the spec's success contract.
- `POST /api/summarize` with spoof attempts (`"mode":"live"`, `"AI_MODE":"live"`, `"scenario":"timeout"` in the body, and an `x-ai-mode: live` header): **200**, `mode: "mock"`, same canned reply. The request cannot switch the mode.
- `POST /api/summarize` with body `not json`: **500**. The server log shows a `SyntaxError` from `request.json()` at `route.ts:12`. The input guard is #8, so this is expected for now (see check 5).
- `GET /api/summarize`: **405** (the route only handles POST).
- I sent two POSTs within one minute and both got 200. The rate limit is #12, so this is expected for now.
- Note, not a FAIL: the dev server printed a "Network" address, which means `next dev` listens on all interfaces, so other machines on the same network can reach it while it runs. This only affects the dev server. Cowrie itself is unaffected.

## Week 6 spec checks

1. **One AI feature only: PASS.** `app/api/summarize/route.ts` is the only API route, and it holds the single summarize feature.
2. **Back end only: PASS.** The AI client is called only in `route.ts` (`getAiClient(mode)`). The client component `Dashboard.tsx` only `fetch`es `/api/summarize` and never imports `lib/aiClient` or `lib/mockAiClient`.
3. **Secret key: N/A.** No provider or key exists yet (`getAiClient` throws for live until #5). No key appears in any new or changed file.
4. **System prompt in code: N/A.** `lib/prompt.ts` doesn't exist yet. It comes in #5 with Joseph's wording.
5. **Guardrail, bad input: N/A (#8).** The route has no input guard yet. Malformed JSON gives a plain 500 (R5), and an empty or missing excerpt goes to the mock as `""`.
6. **Guardrail, bad output: N/A (#10).** `route.ts` runs `JSON.parse(reply.text)` with no Zod schema yet.
7. **Guardrail, failure: N/A (#10).** There is no try/catch or timeout yet. The 500 from Next dev in R5 had no secret in it.
8. **Cost awareness: N/A (#5).** `costUsd` is a fixed `0`. There is no cap or cost note in the UI yet.
9. **Rate limit: N/A (#12).** Two requests in a row both returned 200 (R5).
10. **Local and clean repo: PASS.** The app runs locally (R4, R5). No key, token or credential appears in the diff or in any of the 7 new files. `.env*` is git-ignored, and `.env.local` is not untracked.
11. **Fixture clean: N/A.** `fixtures/sample-session.jsonl` doesn't exist yet (#9).
12. **Rate-limit key not client controlled: N/A (#12).** There is no limiter yet. `route.ts` reads no request headers at all.

## Ticket #3 acceptance boxes

- **UI sample look ported (one font, `--space-1` to `--space-5`, color tokens, consistent buttons and cards): PASS.** `app/globals.css` defines the color tokens and the 8/16/24/32/40 px scale. `layout.tsx` loads only Geist (Geist Mono removed). `page.module.css` has shared `.card`, `.btn`, `.btnPrimary` and `.btnSecondary` classes. The textarea uses a system monospace stack for log text, as the builder notes say the sample does.
- **Header pills (Mock AI amber / Live AI green, plus the 3 static pills): PASS.** `Header.tsx` `ModePill` reads `getAiMode()` on the server (`.pillMock` uses `--warn`, `.pillLive` uses `--success`), and the 3 static pills are present (R5 HTML).
- **Footer shows the D13 statement: PASS.** `Footer.tsx` matches D13 word for word (R5 HTML).
- **Route accepts `{ excerpt }` and returns `{ summary, threatLabel, mode, usage, costUsd }`, with usage 0 in mock: PASS.** Confirmed by R5 and by `route.test.ts` ("returns the canned summary with zero usage and zero cost").
- **Mock replaces only the provider call, `success` returns a valid canned reply, and the mock records the last request: PASS.** `lib/aiClient.ts` is the seam. `mockAiClient` returns raw text that the route parses the same way it will parse a live reply, and it stores `lastRequest` (`getLastMockRequest`). A test asserts `{ excerpt: EXCERPT }`.
- **Mode and scenario read only on the server: PASS.** `getAiMode()` and `getMockScenario()` read `process.env` only. The test "ignores any attempt in the request to switch mode or scenario" and the R5 spoof request both returned `mode: "mock"`.
- **Summary rendered as text, never HTML, with idle and success states: PASS.** `Dashboard.tsx` renders `{result.summary}` as a React text child, with no `dangerouslySetInnerHTML`. `result === null` is the idle state and a result is the success state.
- **First route-seam test calls POST with a constructed request in mock mode and asserts status and body: PASS.** `app/api/summarize/route.test.ts` has 4 tests that build a `Request`, call `POST`, and assert `status` 200 and the JSON body.

## Builder's file list compared with `git status`

- **FAIL: the Session state file list is incomplete.** CLAUDE.md section 10, "Changed files this ticket (#3)", lists `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/page.module.css`, `CLAUDE.md` and `.claude/progress.txt`. `git status` also shows `.claude/agents/verifier.md` (modified: it adds the runtime checks R1 to R6 and widens the verifier's Bash permissions) and `REVIEW.md` (modified). The list doesn't mention either one. The new (untracked) file list does match `git status`.

## End-to-end boundaries

- Source data (fixture): N/A (#9).
- Input: N/A (#8).
- Secret key: N/A (#5). There is no key yet, and `.env*` is ignored.
- System prompt: N/A (#5).
- AI output schema: N/A (#10).
- API failures: N/A (#10).
- **Display: PASS.** The summary is a plain text child, the "AI generated · verify before acting" label appears above it, and the threat badge falls back to neutral for any unmapped label.

## Prompt injection note

N/A for now. There is no live prompt or `<log_excerpt>` wrapping yet. The mock records the request as `{ excerpt }` only. The spec's injection test (`<log_excerpt>` tags in the recorded request) belongs to #5.

## Must fix before commit

1. **Session state file list is incomplete.** Add `.claude/agents/verifier.md` (the R1 to R6 runtime checks and wider Bash permissions) and `REVIEW.md` to "Changed files this ticket (#3)" in CLAUDE.md section 10, or say that they came from the planning session. Either way Joseph sees the verifier permission change before he commits.
   `[approve] / [skip]`: ____
