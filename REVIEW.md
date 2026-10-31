# REVIEW: Week 7 Step 2, CI (planned #15), branch `feat/ci`

**Not ready to commit: runtime checks failed** (R6 only. The verifier could not stop its own dev server with the allowed method because `lsof` is not installed in this sandbox. The server was later stopped from outside this session, and port 3100 is now free. This is a tooling problem, not a code defect. R1 to R5 are green.)

Reviewer: verifier subagent, Oct 31 2026. Every result here comes from `git status`, `git diff`, the files themselves, and commands I ran myself. I did not rely on the builder's summary or on Session state.

**Totals: 32 PASS / 2 FAIL / 3 N/A**

Ticket definition: `docs/week7/SPEC.md` §5 "Step 2. CI" and CLAUDE.md §11.

## Change under review

- `git status`: on branch `feat/ci`. One untracked path, `.github/`, which holds only `.github/workflows/ci.yml` (read in full). No tracked changes: `git diff --stat` is empty.
- `.env.local` does not exist in the repo root and is not in the untracked list. `.gitignore` ignores `.env*` (except `!.env.example`) and `/build.log`.
- `.env.example` has an empty `ANTHROPIC_API_KEY=` value.

## Runtime checks

| # | Check | Result | Output |
|---|---|---|---|
| R1 | `npm run typecheck` | PASS | `next typegen && tsc --noEmit` → "Types generated successfully", exit 0 |
| R2 | `npm run lint` | PASS | `eslint`, no output, exit 0 |
| R3 | `npm test` | PASS | Vitest 5.0.5: "Test Files 11 passed (11) · Tests 162 passed (162)", exit 0 |
| R4 | Dev server `AI_MODE=mock npx next dev --hostname 127.0.0.1 --port 3100` | PASS | `GET /` returned 200 on the first poll (about 1 s) |
| R5 | Routes | PASS | See below |
| R6 | Stop server and confirm port 3100 is free | **FAIL** | `lsof -ti tcp:3100` → `/bin/bash: line 1: lsof: command not found` (exit 127). My allowed commands give me no other way to find or kill the process. A `curl` right after still returned 200. Later, background task `bshn1g61h` ended with exit code 143 (SIGTERM, sent from outside this session, not by me). A follow-up `curl --max-time 3 http://localhost:3100/` got connection refused (curl exit 7, code `000`), so the port is now free. This check stays a FAIL because the verifier cannot perform the stop step itself in this sandbox. |
| Build log | `build.log` (builder's `npm run build`) | PASS | Next.js 16.4.3 (Turbopack): "✓ Compiled successfully in 1412ms", TypeScript finished, 5/5 static pages generated, routes `/` (partial prerender), `/_not-found`, `/api/summarize` (dynamic). No error lines. |

R5 detail:
- `GET /` → 200. The page HTML contains "Mock AI", "Sample logs only", "Next.js on Netlify", "1 request / min" and the footer text "Defensive learning project".
- `POST /api/summarize` with the sample payload → 200, body `{"summary":"Mock reply: no AI model was called. ...","threatLabel":"medium","mode":"mock","usage":{"inputTokens":0,"outputTokens":0},"costUsd":0}`. This matches the contract.
- Second POST within the minute, with a forged `x-forwarded-for: 198.51.100.7` → 429, header `retry-after: 60`, body `{"error":"Only one summary per minute. Try again in about 60 seconds.","retryAfterSeconds":60}`. The forged header did not open a new bucket.
- POST with an empty excerpt and POST with a non-Cowrie excerpt → both 429 (same body). This is expected under D8, because the limiter is checked before the input guard. The input-guard rejections themselves are covered by the route-seam tests in R3.
- This ticket adds no routes and changes none.

## Ticket acceptance (SPEC §5 Step 2)

| # | Box | Result | Evidence |
|---|---|---|---|
| A1 | One workflow, on push to main and on every PR | PASS | `ci.yml` has `on: push: branches: [main]` and `pull_request:`. It is the only file under `.github/workflows/`. |
| A2 | `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` | PASS | Steps "Install", "Typecheck", "Lint" and "Test" run exactly these commands, on Node 22 (matches local Node 22). |
| A3 | Gitleaks pinned v8.30.1 from the GitHub releases, then `gitleaks git --redact --exit-code 1` | PASS | `GITLEAKS_VERSION: 8.30.1`, tarball `gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz` from `github.com/gitleaks/gitleaks/releases/download/v…`. The download is checked against the release checksums file (`sha256sum -c`), and the last step runs `./gitleaks git --redact --exit-code 1`. |
| A4 | Checkout with fetch depth 0 | PASS | `actions/checkout@v5` with `fetch-depth: 0`. |
| A5 | CI env: dummy DB URLs, no migrations, no database, no secrets, mock mode | PASS | Job env sets `AI_MODE: mock` and both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to `postgresql://ci:ci@localhost:5432/ci`. There is no `secrets.` reference, no migrate step and no service container. `permissions: contents: read`. |
| A6 | Any failing step fails the run | PASS | All steps are sequential `run:` steps with no `continue-on-error`. If the checksum `grep` finds no line, `sha256sum -c` gets empty input and exits non-zero, so a bad download still fails the run. |
| A7 | Green run on a PR and on main | N/A | GitHub is blocked from the sandbox, so the verifier cannot see Actions runs. Joseph checks the green run before merging (SPEC §5 note). |
| A8 | Still green after Step 3 with only the dummy URL | N/A | Step 3 is not built yet. |

## Week 6 spec checks

The app code is unchanged in this ticket (no tracked diff). I re-checked each item against the current files.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | One AI feature only | PASS | The CI workflow adds no AI feature. The summarizer is still the only one (`app/api/summarize/route.ts`). |
| 2 | Back end only | PASS | The only `"use client"` file is `app/_components/Dashboard.tsx`, and it contains no `anthropic` import. The SDK is used only in `lib/liveAiClient.ts`, behind the route. |
| 3 | Secret key | PASS | `lib/liveAiClient.ts:23` reads `process.env.ANTHROPIC_API_KEY`. The CI file references no key, and a repo-wide grep (excluding `node_modules`, `.next` and `.git`) found only obvious fake test strings. |
| 4 | System prompt in code, Joseph's wording, 7 rules | PASS | `lib/prompt.ts` (v2, unchanged) has all 7 parts: `role`, `task`, `untrustedData`, `neverAddFacts`, `ifUnsure`, `defenderFraming`, `format` (two fields, four labels, 6 sentences, 700 chars, plain text). |
| 5 | Guardrail, bad input | PASS | Unchanged `lib/inputGuard.ts`. Its route-seam tests pass in R3 (162/162). |
| 6 | Guardrail, bad output | PASS | Unchanged `lib/outputGuard.ts` Zod check. Its tests pass in R3. |
| 7 | Guardrail, failure | PASS | `lib/liveAiClient.ts` sets `timeout: TIMEOUT_MS` and `maxRetries: MAX_RETRIES`, and errors are mapped in `lib/aiFailure.ts`. The leak tests pass in R3. |
| 8 | Cost awareness | PASS | The 4,000-character cap and the cost note are unchanged (`lib/inputGuard.ts`, `Dashboard.tsx`). |
| 9 | Rate limit | PASS | In R5 the second POST got a 429 with `retryAfterSeconds`. |
| 10 | Local and clean repo | PASS | The only new file (`ci.yml`) has no secret. The dummy DB URL is a documented non-secret. `.env.local` is absent and not untracked. |
| 11 | Fixture clean | N/A | `fixtures/sample-session.jsonl` is not new or changed in this ticket. |
| 12 | Rate limit key not client controlled | PASS | `lib/rateLimit.ts:12,24-31`: the key comes only from `x-nf-client-connection-ip`. A missing header falls back to the fixed `shared` bucket, and the IP is stored as salted SHA-256. The forged `x-forwarded-for` in R5 was ignored. |

## End to end boundaries

| Boundary | Result | Evidence |
|---|---|---|
| Source data | PASS | The fixture and the fixture test are unchanged and pass in R3. |
| Input | PASS | Input guard unchanged; its tests pass. |
| Secret key | PASS | Env only. CI needs no secret and uses `permissions: contents: read`. |
| System prompt | PASS | `lib/prompt.ts` is server code and unchanged. |
| AI output schema | PASS | Zod guard unchanged; its tests pass. |
| API failures | PASS | Timeout and 0 retries in `lib/liveAiClient.ts`; error mapping tests pass. |
| Display | PASS | The mock success body renders the contract fields. The page shows the pills and footer (R5). |

## Prompt injection note

| Item | Result | Evidence |
|---|---|---|
| Log content treated as data | PASS | `lib/prompt.ts:46-48` wraps the excerpt in `<log_excerpt>` tags after `neutralizeExcerptTags` escapes any embedded opening or closing tag. Rule `untrustedData` says the tag contents are untrusted. |

## Git and session hygiene

| # | Item | Result | Evidence |
|---|---|---|---|
| G1 | `.env.local` not untracked; ignored paths confirmed | PASS | Confirmed from `.gitignore` (`.env*`, `/build.log`, `/.next/`, `/node_modules`). |
| G2 | Session state matches `git status` | **FAIL** | The builder did not update Session state for Step 2. `git diff` shows no change to `CLAUDE.md` (or `.claude/progress.txt`). §10 still says "Next ticket: Week 7 Step 2" and "New (untracked) files in #5 C9: none". It does not list the new `.github/workflows/ci.yml`. CLAUDE.md §9 step 1 requires this update. |

## Advisories (not failures, for Joseph's awareness)

1. Gitleaks scans the full history (`fetch-depth: 0`). Test strings such as `FAKE_KEY = "sk-ant-test-key-never-shown"` (`app/api/summarize/route.test.ts:151`) and `lib/aiFailure.test.ts:5` are too short for gitleaks' Anthropic rule. They might still trip the generic-api-key rule, and the dummy `postgresql://ci:ci@…` URL is also worth watching. I can't run gitleaks here (not an allowed command), so the first CI run will tell. If one is flagged, the fix is a `.gitleaksignore` entry or a `gitleaks:allow` comment, not a history rewrite.
2. `actions/checkout@v5` and `actions/setup-node@v5` are pinned by tag, not by commit SHA. This is acceptable for a private learning repo; SHA pinning is stronger.

## Must fix before commit

1. **R6: the verifier cannot stop its own dev server in this sandbox (`lsof` missing).** The server from this review has already stopped (exit 143) and port 3100 is confirmed free, so nothing is left running. To make R6 pass in later reviews, add `lsof` to the sandbox image (`lab/openshell/Dockerfile`), or have Joseph approve a different stop method in `.claude/agents/verifier.md`. Then re-run R6.
   `[approve] / [skip]`: approve (Joseph, Oct 31 2026: port confirmed free; lsof fix later)
2. **G2: Session state not updated for Step 2.** Update CLAUDE.md §10 (and `.claude/progress.txt`) with the current ticket, what was done, and the new file `.github/workflows/ci.yml`.
   `[approve] / [skip]`: approve (Joseph, Oct 31 2026: fixed; Session state updated by the builder)
