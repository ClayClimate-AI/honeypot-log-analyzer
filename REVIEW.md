# REVIEW: Week 7 Step 3, Prisma + Neon schema (planned #16 part 1), branch `feat/neon-schema` (re-verify after the A4 fix pass)

**Not ready to commit: runtime checks failed** (R6 only. `lsof` is still not installed in this sandbox, so I could not stop my own mock dev server with the allowed method, and I did not try any other way. The server was later stopped from outside the verifier (background task ended with exit 143, SIGTERM); a follow-up `curl` to http://localhost:3100/ got no connection (curl exit 7), so port 3100 is now free. Joseph already skipped R6 for this step as a known sandbox tool gap; it is recorded here as a FAIL because the rules require it. R1 to R5 are green.)

Reviewer: verifier subagent, Oct 31 2026. Every result below comes from `git status`, `git diff`, the files themselves, and commands I ran myself. I did not rely on the builder's summary or on Session state.

Totals: **33 PASS / 2 FAIL / 2 N/A** (R checks included).

## Runtime checks

| # | Check | Result | Evidence |
|---|---|---|---|
| R1 | `npm run typecheck` | PASS | `next typegen` "✓ Types generated successfully", then `tsc --noEmit`; exit 0. |
| R2 | `npm run lint` | PASS | `eslint`, no output; exit 0. |
| R3 | `npm test` | PASS | "Test Files 14 passed (14)", "Tests 182 passed (182)"; exit 0 (was 178; the 4 new `redactIps` cases are included). |
| R4 | Dev server (`AI_MODE=mock`, 127.0.0.1:3100) | PASS | "✓ Ready in 148ms"; `GET /` returned 200 on the first poll. |
| R5 | Routes | PASS | `GET /` → 200. `POST /api/summarize` with the sample payload → 200, `{"summary":"Mock reply: no AI model was called. …","threatLabel":"medium","mode":"mock","usage":{"inputTokens":0,"outputTokens":0},"costUsd":0}`. Second POST within the minute with forged `x-forwarded-for: 1.2.3.4` and `x-real-ip: 5.6.7.8` → 429, `retry-after: 60`, `{"error":"Only one summary per minute. Try again in about 60 seconds.","retryAfterSeconds":60}`. Server log has only `rate_limit_key { ipHeaderPresent: false }` twice and **no** `history_saved` / `history_save_failed` line, so the mock run was not saved. |
| R6 | Stop the dev server, port 3100 free | **FAIL** | `lsof -ti tcp:3100` → `/bin/bash: line 1: lsof: command not found` (exit 127). Per instructions I did not try any other way to stop it. The server was then stopped from outside the verifier (task exit 143); a follow-up `curl` got no connection (exit 7), so port 3100 is free now. Joseph skipped this item for Step 3 as a known sandbox tool gap. |
| B | `build.log` (§11) | PASS | Next.js 16.4.3: "✓ Compiled successfully in 434ms", "Finished TypeScript", "✓ Generating static pages … (5/5)", routes `/`, `/_not-found`, `ƒ /api/summarize`; no error lines. `find -newer build.log` over `.ts`, `.prisma`, `.mjs` and `package.json` (excluding node_modules, .next, lib/generated) returned nothing, so the log is newer than every source file, including the `redactIps.ts` fix. |

## Week 6 spec checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | One AI feature only | PASS | The diff adds storage of the existing summary (`lib/runStore.ts`, `lib/prismaRunStore.ts`); no new AI call or feature. |
| 2 | Back end only | PASS | The AI call stays in `app/api/summarize/route.ts` (`getAiClient`, line 64); the save runs in the same handler (line 84). The only `"use client"` file is `app/_components/Dashboard.tsx`, and no storage module is imported outside the route and its tests. |
| 3 | Secret key | PASS | `DATABASE_URL` read from `process.env` (`lib/prismaRunStore.ts:12`), `DATABASE_URL_UNPOOLED` in `prisma.config.ts:23`; `.env.example` has empty values; `saveRunSafely` logs only `reason` and the error `code`/`name`, never the message (`lib/runStore.ts:75-80`), tested at `lib/runStore.test.ts:66-76`. |
| 4 | System prompt in code | PASS | `lib/prompt.ts` is not in `git diff` or `git status`; Joseph's v2 wording (all 7 D12 rules, verified in earlier reviews) is unchanged. |
| 5 | Guardrail, bad input | PASS | `checkExcerpt` still runs before `takeRateLimit` and the AI call (`route.ts:48`); unchanged. |
| 6 | Guardrail, bad output | PASS | Save happens only after `checkAiReply` passes (`route.ts:75`, then `84`); `route.save.test.ts` "does not save when the output guard rejects the reply". |
| 7 | Guardrail, failure | PASS | AI failure mapping unchanged; DB failures caught and time-boxed at 3,000 ms (`SAVE_TIMEOUT_MS`), and the summary is still returned (`route.save.test.ts` "still returns the summary when the database fails"). |
| 8 | Cost awareness | PASS | 4,000 char cap and cost note unchanged; the saved row stores `costUsd` from `lib/cost.ts`. |
| 9 | Rate limit | PASS | R5: second POST within a minute → 429. |
| 10 | Local and clean repo | PASS | Secret grep (repo minus node_modules, .next, lib/generated, .git) and the lockfile diff found only known fakes/dummies: `sk-ant-should-never-show` (`lib/aiFailure.test.ts:5`), `sk-ant-test-key-never-shown` (`app/api/summarize/route.test.ts:151`), and the CI dummy `postgresql://ci:ci@localhost:5432/ci` (`.github/workflows/ci.yml:17-18`, docs). The old `postgres://…` test string in `lib/runStore.test.ts` is gone (now plain text at line 67). No `.env.local` exists. |
| 11 | Fixture clean | N/A | `fixtures/sample-session.jsonl` is not new or changed. |
| 12 | Rate limit key not client controlled | PASS | `lib/rateLimit.ts` unchanged; route still uses `clientKey(request.headers)`; forged `x-forwarded-for` and `x-real-ip` did not escape the shared bucket (R5). |

## Step 3 acceptance (docs/week7/SPEC.md §5, Step 3)

| # | Box | Result | Evidence |
|---|---|---|---|
| A1 | Prisma 7 + `@prisma/adapter-neon`, URL in `prisma.config.ts`, client from generated folder | PASS | `package.json` adds `prisma`, `@prisma/client`, `@prisma/adapter-neon` ^7.10.1; `schema.prisma` datasource has no `url`; generator `prisma-client` → `../lib/generated/prisma`; `prismaRunStore.ts` imports `./generated/prisma/client` and uses `PrismaNeon`. |
| A2 | `postinstall: prisma generate` | PASS | `package.json` scripts; `/lib/generated/` git-ignored and ESLint-ignored. |
| A3 | One table with the listed columns; never the raw excerpt | PASS | `model SavedRun` → `saved_runs`: summary, threat_label, mode, input/output tokens, cost_usd, excerpt_length, excerpt_sha256, created_at (+ id). `buildSavedRun` keeps only `excerpt.length` and a SHA-256 hex digest; tests assert the excerpt is absent. |
| A4 | Attacker IPs in the summary → "attacker IP" (IPv4 and IPv6), tested against the fixture | **FAIL** | The three reported cases are fixed and tested (`redactIps.test.ts:28-44`: `IP:2001:db8::1`, `2001:db8::1:`, `::1.`/`fe80::.`, `...203.0.113.5`), and 1.2.3.4.5 / 999.1.1.1 / times stay untouched. Remaining gap, by code trace (I can't run ad hoc code): an IPv6 address right after a colon is still missed when the word before the colon ends in a hex letter (a–f) and the address has 7–8 groups. Example `Code:2001:db8:0:0:0:0:0:1`: the candidate regex starts at `d` and matches `de:2001:db8:0:0:0:0:0:1` (9 groups, not valid); the loop only sets aside leading `:`/`.` characters, not a leading `de:`, so nothing is redacted and the IPv4 pass doesn't apply. Narrow (needs no space after the colon and a long form address), but it is the same "IPv6 after a colon" class as the approved fix. Fix idea: when the whole run fails, also try starting just after each colon in the run; add a test such as `Source:2001:db8:0:0:0:0:0:1`. |
| A5 | Save only after the output guard; mock not saved; DB failure never blocks the summary | PASS | `route.ts:84` `if (mode === "live")` after the guard; 3 route-seam tests; R5 log shows no save line in mock. |
| A6 | Injected fake store; builder runs no migrations | PASS | `setRunStoreForTests` in all save tests; `prisma/` contains only `schema.prisma` (no `migrations/`). |
| A7 | CI still green after Step 3 with only the dummy URL | N/A | I can't run CI. Supporting evidence: `prisma.config.ts` reads the URL without `env()`, so `prisma generate` doesn't need a real URL. Joseph checks the first CI run. |
| G1 | `git status` matches Session state | PASS | Untracked: `app/api/summarize/route.save.test.ts`, `lib/prismaRunStore.ts`, `lib/redactIps.ts`, `lib/redactIps.test.ts`, `lib/runStore.ts`, `lib/runStore.test.ts`, `prisma.config.ts`, `prisma/` (only `schema.prisma`). Modified: `.claude/progress.txt`, `.env.example`, `.gitignore`, `CLAUDE.md`, `REVIEW.md`, `route.ts`, `eslint.config.mjs`, `package.json`, `package-lock.json`. Matches Session state's list. |
| G2 | `.gitignore` and `.env.local` | PASS | `.gitignore` has `.env*` with `!.env.example`, `/build.log`, `/lib/generated/`; `.env.local` does not exist and is not in the untracked list. |

## End to end boundaries

| Boundary | Result | Evidence |
|---|---|---|
| Source data | PASS | Fixture unchanged; fixture rules tests among the 182 passing. |
| Input | PASS | `checkExcerpt` before the AI call, unchanged. |
| Secret key | PASS | AI key and DB URLs only from env; never logged (check 3). |
| System prompt | PASS | `lib/prompt.ts` unchanged. |
| AI output schema | PASS | Zod check before display and before save. |
| API failures | PASS | AI failure mapping unchanged; DB failure isolated with a 3 s timeout and a code-only log. |
| Display | PASS | Screen gets the unredacted, validated `output.value.summary`, as before. |
| Storage (new) | PASS | Raw excerpt never stored; live only; after the guard; failure isolated. The redaction gap is counted once, under A4. |

## Prompt injection

PASS. `buildUserMessage` still wraps the excerpt in `<log_excerpt>` with tag neutralizing (`lib/prompt.ts` unchanged). The save path stores only the Zod-valid summary, so injected text reaches the database only as a guarded summary.

## Advisories (not counted)

1. Over-redaction (safe direction, cosmetic): a word ending in hex letters right before `::` or an IPv6 address gets eaten with it, e.g. `ID:2001:db8::1` → `Iattacker IP`, `Note:: x` → `Notattacker IP x` (`e::` is a valid IPv6 address). It only affects the saved copy.
2. Worst-case time is 8 s (AI) + 3 s (save) = 11 s: under Netlify's current 30 s limit (D7), over the older 10 s figure; confirm at deploy.
3. ADR `docs/week7/adr/0018-neon-storage-and-admin-password.md` signature is Joseph's to check.
4. A real Neon write is not proven here; Joseph checks after running the migration.
5. Sandbox tooling: third review in a row where R6 fails for lack of `lsof`; each time the mock server had to be stopped from outside the verifier.

## Must fix before commit

1. **R6**: `lsof` is missing, so the verifier could not stop its own mock dev server with the allowed method. It was stopped from outside (exit 143) and port 3100 is free now; the open item is the tool gap. (Joseph already skipped this for Step 3.) `[approve] / [skip]`
2. **A4**: `lib/redactIps.ts` still misses a long form IPv6 address after a colon when the word before it ends in a hex letter (e.g. `Code:2001:db8:0:0:0:0:0:1` stays unredacted). Also try starting after each colon in the run, and add a test. `[approve] / [skip]`

── REVIEW DONE: 33 PASS / 2 FAIL ──
