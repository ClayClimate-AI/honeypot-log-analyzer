# Handoff: Week 7 upgrade, built inside OpenShell
Paste this as the first message to Claude Code inside the sandbox (guide Step 8).

Read CLAUDE.md (especially §6 and §11), then docs/week7/SPEC.md and docs/week7/adr/*.md. If docs/week7/ is missing, stop and ask Joseph.

## The key point
OpenShell, Prisma and Neon are not separate projects. They are one upgrade to this app, starting from main as committed (C9 done: 6 sentences, 700 characters). One path, in the order in SPEC.md section 3. No parallel tracks, no worktrees.

## Why each piece is here
- Today nothing persists between runs. Neon gives a real Postgres database: saved history, an admin login, and cost per saved run.
- Prisma 7 with `@prisma/adapter-neon` is how the app talks to Neon.
- OpenShell is where you, the agent, do this work. You run inside a sandbox on Joseph's Mac, so you cannot leak the key or reach any host the policy does not allow.

## The key rule
Joseph's real Anthropic key stays with Joseph. Inside the sandbox you only ever see a placeholder starting with `openshell:resolve:`. Never ask for the key, print it, write it to a file, or try to read the real value. If something fails because of the key, stop and tell Joseph.

## Where you are
- Repo at `/sandbox/hp-fresh` (a fresh clone; no .env files).
- Allowed: Anthropic (only as /usr/local/bin/claude, through the provider), platform.claude.com (only as /usr/local/bin/claude), the npm registry and Google Fonts (node), api.github.com (curl). Everything else is denied, including github.com.
- If a host is denied, report the DENIED log line (Joseph can run `openshell logs build --since 5m --source sandbox` on his Mac) and stop. Do not work around it. Joseph decides whether to add a named rule.
- You never connect to the real Neon database. Build and test against an injected fake store. Joseph runs migrations on his Mac.

## Upgrade path (stop after each numbered step)
2. CI. GitHub Actions workflow: `npm ci`, typecheck, lint, tests, gitleaks command line v8.30.1 (`gitleaks git --redact --exit-code 1`, fetch depth 0). Dummy `DATABASE_URL` and `DATABASE_URL_UNPOOLED` = `postgresql://ci:ci@localhost:5432/ci`. No migrations, no secrets.
3. Prisma + Neon. Schema, Neon adapter, `postinstall: prisma generate`. Save only after the output guard passes. Store summary, label, mode, tokens, cost, excerpt length and SHA-256; never the raw excerpt. Replace attacker IPs with "attacker IP" before saving. Mock runs not saved. A DB failure never blocks the summary.
4. History + admin login. Create, list, view, delete (no update); delete 204 then 404. `ADMIN_PASSWORD`, constant time compare. Signed httpOnly, Secure, SameSite=Strict cookie, 8 h, signed with `SESSION_SECRET`. 5 wrong tries then 15 minutes. 10 saves per day, midnight to midnight America/Chicago. Skip a duplicate hash within 24 h. Delete rows older than 30 days on save. Injected fake store in tests. One sample log first.
5. Cost per saved run, from the existing `lib/cost.ts`.
6. Deploy, only after Joseph says "go deploy". Run `npm run build` inside first and save the output to `build.log`. Joseph links Netlify and sets every env var. Prove `x-nf-client-connection-ip` at the first deploy.
7. README. Mermaid data flow (input, guards, AI call, save to Neon, history screen) and how OpenShell protects the build.

## Rules
- At the start of each step, create its feature branch (`feat/ci`, `feat/neon-schema`, `feat/history-auth`, `feat/run-cost`, `docs/readme`) from the latest main Joseph gives you. Commit only to that branch. Never push (github.com is blocked anyway), merge, rebase, force push or reset.
- Before stopping: typecheck, lint, tests, `npm run build` with mock env and the dummy DB URLs (output to `build.log`, which is git-ignored), then call the `verifier` subagent once. It runs R1 to R6 and reads build.log; it never runs build. It is the only subagent; spawn no others.
- EVIDENCE.md: Joseph writes every answer; you only format his pasted answers per CLAUDE.md §6. Never write ADR RCA sections or other graded reasoning.
- AI_MODE=mock unless Joseph says live. The dev server binds to 127.0.0.1 only.
- Never print secrets. Never create GitHub issues.
- Report every change in PIOF format (Purpose, Input, Output, Flow).
- At the end of each step: show the diff summary and test results, end with `── READY FOR REVIEW: step n ──`, and wait. Joseph downloads, reviews, pushes and merges.

## Output format (Joseph's global rules; they are not inside the sandbox, so here they are)
- Before a step, print: `▶ STEP {id} · {short title} (issue #{n}) · {k} of {total}`
- For every shell command: print `What this does: {plain words}`, run ONE short command (no `;` or `&&` chains unless asked), then print `✓ {result}` or `✗ {result}`.
- When a step is done, print: `✔ {id} done · next: {next id} {next title}`
- Keep `.claude/progress.txt` updated at every step, in this format:
```
stage: W7
step: 2 (1 of 6)
issue: #15
title: CI
```

## Start
Show `git status` and `git log --oneline -3`. Confirm you are inside the sandbox: `printf %s "$ANTHROPIC_API_KEY" | cut -c1-18` must print `openshell:resolve:` (never print more). Then propose Step 2.
