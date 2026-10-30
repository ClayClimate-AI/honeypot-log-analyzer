# SPEC: Cowrie AI Summarizer, Week 7 upgrade (Neon + Prisma, built inside OpenShell)
Baseline: main at 97b276b (C9 done: 6 sentences, 700 characters, prompt v2). Deadline: Mon Nov 2, 10:00 AM CT.
Plan confirmed by Joseph, Oct 30 2026 (grill round with the builder; decisions listed in section 2).
Replaces the earlier draft that assumed a 3 sentence cap, a separate C9 branch and two parallel builders.

## 1. Current state (97b276b)
```
main
├─ Built and green: mock + live Haiku 5.5, system prompt v2, input guard (4,000 chars),
│  output guard (700 chars, 6 sentences, four labels), failure guard (504 timeout, 503 unavailable),
│  rate limit (in memory, 1 per minute), cost notes ($0.0001–$0.0008 measured range)
├─ Issues: #5 work done (GitHub issue still open), #13 deploy, #14 final review open
├─ No DB, no CI, no deploy, no auth
└─ OpenShell 0.1.6 proven on Joseph's Mac Oct 30 (docs/week7/OPENSHELL_MAC_GUIDE.md), real-key check OK
```

## 2. Decisions (Joseph, Oct 30 2026)
```
Decisions
├─ One upgrade, one path, in order. No parallel builders, no worktrees.
├─ The builder runs inside an OpenShell sandbox on Joseph's Mac (D17, D20).
├─ Changes leave the sandbox only by `openshell sandbox download`; Joseph reviews, pushes, merges.
│  github.com stays blocked; the builder commits only on its feature branch inside the sandbox.
├─ Sandbox policy: deny by default; named rules for api.github.com (curl, demo),
│  registry.npmjs.org and fonts.googleapis.com / fonts.gstatic.com (node, build).
│  Anthropic only through the claude-code provider. Proven Oct 30.
├─ The builder never touches the real Neon database: it builds against an injected fake store.
│  Joseph creates the Neon project, sets env vars and runs `prisma migrate deploy` on his Mac
│  (setup wizard, outside the sandbox).
├─ Cookie signing secret: its own env var, SESSION_SECRET (32+ random bytes).
├─ EVIDENCE.md: Joseph writes every answer; the agent only formats per CLAUDE.md §6.
├─ C9 is done (97b276b). No C9 ticket in Week 7; the 5 live runs can be part of #18.
├─ Cowrie stays local (D19).
└─ Blueprint site (cowrie-summarizer-blueprint.netlify.app): dropped for Week 7.
```

## 3. Upgrade path (in order, one step at a time)
```
Path
├─ Step 0  Docs (done outside the sandbox): this folder, CLAUDE.md §11, lab/openshell/. Joseph commits.
├─ Step 1  Sandbox up (Joseph): guide Steps 5 to 7 on a fresh clone of that commit.
├─ Step 2  CI (planned #15): typecheck, lint, tests, gitleaks
├─ Step 3  Prisma + Neon schema and adapter (planned #16, part 1)
├─ Step 4  History CRUD + admin login (planned #16, part 2)
├─ Step 5  Cost per saved run (planned #16, part 3)
├─ Step 6  Deploy: Netlify + Neon + env vars (#13), only after "go deploy"
├─ Step 7  README: data flow and how OpenShell protects the build (planned #19)
├─ HITL    Real key run on prod, real users, rehearsal (planned #18, Joseph)
└─ #14     Final review, once, after #18
```

## 4. Timeline (Joseph's hours: Fri 6–10 PM, Sat 8 h, Sun TBD)
```
Fri 6–10 PM (4 h)  Step 0 review + commit (30 min) → Step 1 sandbox up (30 min) → Step 2 CI
Sat (8 h)          Step 3 → Step 4 → Step 5; Joseph runs the Neon setup wizard in parallel
Sun (TBD)          Step 6 deploy → #18 real key run + users + rehearsal → Step 7 README → #14
Mon until 10 AM    Buffer only. Backup recording ready.
Cut order if short: Step 7 README polish → #18 real users → Step 5 cost per run (cost already shows per call)
```

## 5. Step details and acceptance

### Step 2. CI (planned #15)
One GitHub Actions workflow on push to main and on every PR: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, gitleaks.
Gitleaks: the free command line, pinned v8.30.1 (`gitleaks_8.30.1_linux_x64.tar.gz` from github.com/gitleaks/gitleaks/releases), checkout with fetch depth 0, then `gitleaks git --redact --exit-code 1`.
CI env: `DATABASE_URL` and `DATABASE_URL_UNPOOLED` = `postgresql://ci:ci@localhost:5432/ci` (dummy, never a secret). No migrations, no database, no secrets, mock mode.
Acceptance: any failing step fails the run; green run on a PR and on main; still green after Step 3 with only the dummy URL.
Note: the repo is private on the free plan, so branch protection is unavailable; Joseph checks the green run before he merges.

### Step 3. Prisma + Neon (planned #16 part 1)
Prisma 7 with `@prisma/adapter-neon` (Neon's documented Prisma 7 setup: datasource URL in `prisma.config.ts`, not the schema; client imported from the generated folder).
`postinstall: prisma generate`, so Netlify never builds with a stale client.
One table for saved runs: summary, threat label, mode, input and output tokens, cost, excerpt length, excerpt SHA-256, created at. Never the raw excerpt.
Before save, attacker IPs in the summary are replaced with "attacker IP" (IPv4 and IPv6; tested against the 203.0.113.x fixture).
Save only after the output guard passes. Mock runs are not saved. A database failure never blocks the summary.
Tests use an injected fake store. Migrations are run by Joseph on his Mac, not by the builder.

### Step 4. History + admin login (planned #16 part 2)
Create, list, view, delete. No update. Delete returns 204, then 404.
One shared `ADMIN_PASSWORD` (env), constant time compare. `/admin` page: one password field, Unlock; Lock clears the cookie.
Cookie: httpOnly, Secure, SameSite=Strict, signed with `SESSION_SECRET`, lasts 8 h.
5 wrong tries then a 15 minute wait (in memory, like the rate limit; resets on a cold start, stated in the README).
Summarizer stays public; history pages and history API routes are gated (401 when locked).
At most 10 saves per day, counted in the database, midnight to midnight America/Chicago; over the cap the save is skipped, `history_cap_reached` is logged, and the summary is still returned.
Same excerpt hash within 24 h is not saved again. Rows older than 30 days are deleted on save.
Prove with one sample log first.

### Step 5. Cost per saved run (planned #16 part 3)
Each saved run shows tokens in/out and cost, using the existing `lib/cost.ts` price constants.

### Step 6. Deploy (#13), only after "go deploy"
Joseph links Netlify and sets every env var himself: `ANTHROPIC_API_KEY`, `AI_MODE`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ADMIN_PASSWORD`, `SESSION_SECRET`.
Builder runs `npm run build` (mock env, dummy DB URLs) inside the sandbox first and saves the output to `build.log` (catches the `.jsonl` loader and Prisma generate).
At the first deploy: prove `x-nf-client-connection-ip` reaches the route (two curls with forged `x-forwarded-for`, second gets 429; `ipHeaderPresent: true` in the function log).

### Step 7. README (planned #19)
Mermaid data flow: input, guards, AI call, save to Neon, history screen. How OpenShell protects the build (policy, provider placeholder, changes leave only through Joseph). Rate limit and login lockout are in memory (known limitation).

### HITL (planned #18, Joseph)
One live Haiku run on prod with cost noted; at least 2 people paste sample logs, feedback recorded by Joseph; one rehearsed live agent change, timed; backup recording.

## 6. Who verifies
Inside the sandbox: the builder runs typecheck, lint, tests and `npm run build` (output saved to `build.log`), then calls the verifier subagent, which runs R1 to R6 and reads `build.log` (it never runs build).
Joseph: reviews the downloaded diff, checks the green CI run, the live Neon connection, the browser and the deploy by hand before he merges.

## 7. Pre demo confirmation (all before Monday)
```
Ready
├─ Green CI run on main after the last merge
├─ Verifier REVIEW.md for the last step, green
└─ Joseph's own pass: OpenShell 4 tests, live Neon on Netlify, history login
```

## 8. Planned issues (not created; Joseph creates them, or keeps them as SPEC sections)
#15 CI · #16 Neon history (Steps 3 to 5) · #13 deploy (existing, expanded) · #17 OpenShell (done as proven setup + demo) · #18 HITL · #19 README · #20 Week 8 parking lot (shared rate limit store, per user auth, Cowrie capture batches).
