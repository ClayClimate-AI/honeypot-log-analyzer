# D18 · Neon stores summaries; one shared admin password guards history
Status: Accepted when signed by Joseph below
Context: Week 7 needs history CRUD on a public URL. Without auth anyone could read or delete every run.
Decision: Neon Postgres via Prisma 7 and `@prisma/adapter-neon`, with `postinstall: prisma generate`. Save only after the output guard passes. Store summary, label, mode, tokens, cost, excerpt length and SHA-256 hash, never the raw excerpt. One shared admin password (`ADMIN_PASSWORD`, Netlify env and .env.local only) protects list, view and delete; the login cookie is signed with its own secret (`SESSION_SECRET`). Cap of 10 saves per day via DB count, duplicate check (same excerpt hash within 24 h not saved), one sample log proven first, 30 day retention. Data boundary (replaces the blanket "no attacker data leaves the machine" rule): saved summaries may quote attacker commands; attacker IPs are replaced with "attacker IP" before save; the raw log is never stored. The builder works against an injected fake store and never connects to the real database; Joseph creates the Neon project, sets the env vars and runs migrations on his Mac.
Approved defaults (Joseph, Oct 30 2026, 11:23 AM CT): admin login cookie lasts 8 h; 5 wrong login tries then a 15 minute wait; 30 day auto delete; mock runs not saved; daily cap of 10 counted midnight to midnight America/Chicago; no Update in CRUD.
Consequences: About 1 h for auth; single password is simple but shared, not per user; the login lockout is in memory (resets on a cold start), like the rate limit.
Signed: ____________________ Date: ________

## RCA (root cause analysis, Joseph writes)
- Problem or risk that led to this decision:
- Root cause (why it happens):
- Why this decision fixes the root cause:
- How I will know it worked:
