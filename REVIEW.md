# REVIEW: Ticket #5, step C9 (prompt change to 6 sentences / 700 characters)

Reviewer: verifier subagent, Oct 30 2026. Evidence comes only from `git status`, `git diff`, the files themselves, and commands I ran. Runtime checks R1 to R6 are all green. One ticket acceptance box fails (process, not code).

**Totals: 37 PASS / 1 FAIL / 7 N/A**

## Evidence gathered

- `git status`: 9 modified tracked files (`.claude/progress.txt`, `CLAUDE.md`, `EVIDENCE.md`, `REVIEW.md`, `docs/spec.md`, `lib/liveAiClient.ts`, `lib/outputGuard.test.ts`, `lib/outputGuard.ts`, `lib/prompt.ts`), **no untracked files**. Session state in CLAUDE.md §10 says "New (untracked) files this ticket: none", which matches.
- Session state's "Changed files this ticket" lists every modified file except `REVIEW.md` (the verifier's own file from the earlier Oct 28 run). No real mismatch.
- `.gitignore` line 34 ignores `.env*` (line 35 re-includes only `.env.example`). `.env.local` does not appear in `git status`. The dev server log shows "Environments: .env.local", so the file exists locally and stays ignored.
- What the diff changes: `lib/prompt.ts` changes only the `format` part (now "6 short sentences ... exactly 6 sentences, each under 20 words. Never over 700 characters ..."). `lib/outputGuard.ts` raises `MAX_SUMMARY_CHARS` from 600 to 700 and `MAX_SUMMARY_SENTENCES` from 3 to 6. Tests are updated to match (701 chars and 7 sentences are rejected; a new test accepts 6 sentences). `lib/liveAiClient.ts` changes a comment only. D5, D12 rule 7 and `docs/spec.md` (story 6 and the output guard line) now say 6 / 700. The EVIDENCE.md answer format rule was added to CLAUDE.md §6, with §1, D16 and spec line 257 updated to match. `EVIDENCE.md` gets a new line 3 and formatted Day 1 Q1 to Q3 answers with call graphs. I only read `EVIDENCE.md`; I did not touch it.

## Runtime checks

| # | Check | Result | Output |
|---|---|---|---|
| R1 | `npm run typecheck` | PASS | `next typegen && tsc --noEmit` → "Types generated successfully", exit 0 |
| R2 | `npm run lint` | PASS | `eslint`, no output, exit 0 |
| R3 | `npm test` | PASS | "Test Files 11 passed (11) · Tests 162 passed (162)", exit 0 |
| R4 | Dev server `AI_MODE=mock`, 127.0.0.1:3100 | PASS | "Ready in 296ms"; `GET /` returned 200 on the first poll |
| R5 | Routes | PASS | See below |
| R6 | Stop server | PASS | `lsof -ti tcp:3100` → 56263; `kill 56263`; a second `lsof` returned nothing (exit 1), so the port is free. The server exited with 143 (SIGTERM). |

R5 detail:
- `GET /` → 200. The page has the pills "Mock AI", "Sample logs only", "Next.js on Netlify" and "1 request / min", plus the cost note "Cap: 4,000 characters · about $0.0001–$0.0003 per call (Claude Haiku 5.5) · measured cost ...". The system prompt text ("log analyst for a security defender") does not appear in the page HTML.
- `POST /api/summarize` `{"excerpt":"   "}` → 400 `{"error":"Paste or upload a Cowrie log excerpt first."}`
- `POST` non-Cowrie text → 400 `{"error":"This doesn't look like Cowrie JSON log output."}`
- `POST` the sample payload → 200 `{"summary":"Mock reply: ...","threatLabel":"medium","mode":"mock","usage":{"inputTokens":0,"outputTokens":0},"costUsd":0}`
- A second `POST` of the same sample within the minute, with a forged `x-forwarded-for: 198.51.100.77` → 429, header `retry-after: 56`, body `{"error":"Only one summary per minute. Try again in about 56 seconds.","retryAfterSeconds":56}`. The forged header did not escape the shared bucket.
- `POST` with 4,001 characters while the limit was active → 429. This is the D8 order working as designed (the limiter is checked first). The 400 with the character count is covered by the route-seam tests in R3.
- Server log: each request logged only `rate_limit_key { ipHeaderPresent: false }`. No IP, key or error object was logged.
- Not run: the `bad_output`, `refusal`, `timeout` and `rate_limited` mock scenarios. They need a server restart with `AI_MOCK_SCENARIO` set, and they are covered by the route-seam tests in R3.

## Week 6 spec checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | One AI feature only | PASS | `app/api/summarize/route.ts` is still the only AI route, and this diff adds no new feature. |
| 2 | Back end only | PASS | Only files in `lib/` import `@anthropic-ai/sdk`. `app/_components/Dashboard.tsx` ("use client") imports only `type { ThreatLabel }` from `outputGuard`, which is removed at compile time. |
| 3 | Secret key | PASS | `lib/liveAiClient.ts:23` reads `process.env.ANTHROPIC_API_KEY`. No key-like string appears outside the fake test values in `route.test.ts` and `aiFailure.test.ts`, and the server log showed no key. |
| 4 | System prompt in code, all 7 D12 rules | PASS | `lib/prompt.ts`: role (line 8, analyst for a defender); task (line 11, what happened / means / watch); untrusted `<log_excerpt>` (line 14); no added facts (line 17); `unknown` if unsure (line 20); defender framing only (line 23); format (line 26: two fields, four labels, 6 sentences, 700 chars, plain text, no markdown or HTML). This matches the updated D12 rule 7. Only the `format` string changed, and it matches the wording recorded as Joseph's in §10. |
| 5 | Bad-input guardrail | PASS | Whitespace and non-Cowrie input got 400 from the server before the AI call. The over-cap case is covered by route tests (R3). |
| 6 | Bad-output guardrail | PASS | `lib/outputGuard.ts` Zod schema: trimmed summary 1 to 700 chars, at most 6 sentences, label enum, refusal rejected. The route returns 502 with the friendly message on failure. |
| 7 | Failure guardrail | PASS | `route.ts:61-70` has a try/catch that calls `mapAiError` and logs only the code and detail. Timeout 8,000 ms and 0 retries are set in `liveAiClient.ts:10-11`. |
| 8 | Cost awareness | PASS | 4,000-character cap and the visible cost note were seen in the page HTML. Measured `costUsd` comes from `lib/cost.ts` (prices dated 2026-10-06). See advisory A4. |
| 9 | Rate limit | PASS | The second POST within a minute got 429 with `Retry-After`. |
| 10 | Local and clean repo | PASS | No untracked files, `.env*` is ignored, and no secrets are in the diff (I grepped for key patterns). |
| 11 | Fixture clean | N/A | `fixtures/sample-session.jsonl` is not new or changed. Its fixture test still passes in R3. |
| 12 | Rate-limit key not client controlled | PASS | `lib/rateLimit.ts:24-31` reads only `x-nf-client-connection-ip`, hashes it with a salt, and falls back to the shared bucket. The forged `x-forwarded-for` still got 429. |

## Ticket #5 acceptance boxes

| # | Box | Result | Evidence |
|---|---|---|---|
| T1 | SDK, `claude-haiku-5-5`, effort low, 8,000 ms, 0 retries | PASS | `lib/liveAiClient.ts:6,10,11,34` |
| T2 | Key only from a server env var | PASS | `liveAiClient.ts:23`; not in any client file |
| T3 | Excerpt wrapped in `<log_excerpt>` | PASS | `prompt.ts:46-48`, with tag neutralizing at lines 33-42 |
| T4 | Prompt pasted word for word, covers 7 rules | PASS | See check 4. Authorship can't be proven from files; the diff changes only the `format` string. |
| T5 | Route-seam test: mock records the system prompt and wrapped excerpt | PASS | `route.test.ts:57-62` |
| T6 | Joseph's live run (Live AI pill, tokens, `mode: "live"`) | N/A | Live-only. The verifier runs mock only. |
| T7 | Workspace and spend limit confirmed | N/A | Joseph's Console action; can't be checked from files. |
| T8 | Exploration 2 evidence | N/A | Joseph's evidence |
| T9 | Price constants labeled with a date | PASS | `lib/cost.ts:5-9` |
| T10 | Server computes `costUsd` | PASS | `route.ts:84` |
| T11 | Input-card cost note | PASS | Matches D13's current wording (revised by Joseph on Oct 27), seen in the page HTML |
| T12 | Result card shows tokens and cost; mock shows 0 | PASS | Mock response has `usage` 0/0 and `costUsd` 0 |
| T13 | "~$0.002" gone | PASS | No match for `0.002` in `app/` |
| T14 | Route-seam test: mock has zero usage and cost | PASS | `route.test.ts:51` |
| T15 | Builder stopped before prompt wording | N/A | A process step; not visible in files |
| T16 | **The diff for this step touches only the system prompt** | **FAIL** | The working tree also changes `lib/outputGuard.ts` (schema 600→700, 3→6), `lib/outputGuard.test.ts`, `lib/liveAiClient.ts` (comment), `docs/spec.md`, `CLAUDE.md` (D5, D12, the new §6 rule) and `EVIDENCE.md`. All are recorded in §10 as Joseph's calls, but if this is committed as one change, there is no prompt-only diff for the Day 1 Exploration 3 evidence. |
| T17 | Prompt still covers all 7 D12 rules | PASS | See check 4 |
| T18 | Joseph runs the same excerpt live before and after | N/A | Live-only and still pending. §10 records the Oct 30 live run as failing `too_many_sentences`; no run after this change is recorded. |
| T19 | Before/after evidence | N/A | Joseph's evidence |

## End-to-end boundaries

| Boundary | Result | Evidence |
|---|---|---|
| Source data | PASS | Fixture unchanged; its rules test passes (R3) |
| Input | PASS | 400s from the server for empty and non-Cowrie input (R5) |
| Secret key | PASS | Env-only, ignored by git, never logged (check 3) |
| System prompt | PASS | In server code, all 7 rules (check 4) |
| AI output schema | PASS | Zod 700 / 6 / enum / refusal (check 6); tests for 700 ok / 701 rejected and 6 ok / 7 rejected pass |
| API failures | PASS | try/catch, mapped codes, no error object returned (check 7) |
| Display | PASS | No `dangerouslySetInnerHTML` in `app/`; the summary is rendered as text |

## Prompt injection

PASS. `buildUserMessage` wraps the excerpt in `<log_excerpt>` tags after neutralizing any `log_excerpt` tags inside it (`prompt.ts:33-48`). The `untrustedData` rule tells the model that the tag contents are data, never instructions. The Zod schema is the backstop: whatever the model is talked into, only a summary of at most 700 characters and one of four labels can come out.

## Advisory (not FAILs; for Joseph)

- A1. The prompt targets the edge of the schema. "Exactly 6 sentences" is also the schema maximum, and 6 sentences of up to 19 words each is about 114 words, roughly 650 to 750 characters, which is at or over the 700 cap. Both earlier live failures (`too_big`, then `too_many_sentences`) were at the cap. The wording is Joseph's to weigh; nothing was changed.
- A2. `lib/prompt.ts:4` still says `// v1:` although the `format` part has changed (already noted as open in §10).
- A3. In `EVIDENCE.md`, the Q3 call graph node says "output guard (max 3 sentences)", but the limit is now 6. This is Joseph's file, and only he can approve an edit.
- A4. The cost note says "$0.0001–$0.0003", but §10 records a measured live call at $0.000727, mostly from thinking tokens. The D13 wording is Joseph's.
- A5. The §10 "C9 progress (Oct 28)" line still quotes the 3-sentence / 600-character wording. It's historical, but it could mislead a fresh builder.

## Must fix before commit

1. T16: the step's diff is not prompt-only. Suggested fix, with no code change: Joseph commits in two parts. First, the schema change (`lib/outputGuard.ts`, its test, the `liveAiClient.ts` comment, D5 / D12 / spec) together with the docs and `EVIDENCE.md` changes. Second, `lib/prompt.ts` on its own, so the Exploration 3 diff touches only the system prompt. Or skip this, if Joseph accepts one combined commit.  `[approve] / [skip]`
