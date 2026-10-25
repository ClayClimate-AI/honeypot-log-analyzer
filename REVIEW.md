# REVIEW: ticket #00 (scaffold + loop rehearsal)

Verifier pass, Oct 24 2026. Read-only. Commands run: `git status --untracked-files=all`, `git status --ignored --short`. No commits exist, so `git diff` is empty; every untracked file the builder listed in Session state was read directly, plus the untracked files it did not list.

Ticket 00 adds no AI feature, so most spec checks have nothing to check yet. Those are marked **N/A** and are not counted in the totals.

## Week 6 spec checks

1. **One AI feature only:** N/A. No AI feature yet; `app/page.tsx` is a static placeholder.
2. **Back end only:** N/A. No AI call exists. `lib/aiMode.ts` is imported only by `lib/aiMode.test.ts`, with no client component.
3. **Secret key:** PASS. `.env.example` has `ANTHROPIC_API_KEY=` with an empty value, and `.gitignore` lines 34–35 (`.env*`, `!.env.example`) ignore every other env file. No key appears in any source file.
4. **System prompt in code:** N/A. `lib/prompt.ts` does not exist yet (ticket 03).
5. **Guardrail, bad input:** N/A (ticket 06).
6. **Guardrail, bad output:** N/A (ticket 08).
7. **Guardrail, failure:** N/A (ticket 09).
8. **Cost awareness:** N/A (ticket 04).
9. **Rate limit:** N/A (ticket 10).
10. **Local and clean repo:** PASS. No API keys or tokens in any untracked file. `git status --ignored` shows `node_modules/`, `.next/`, `.scratch/`, `context/`, `next-env.d.ts`, `.claude/settings.local.json` ignored. No `.env.local` exists yet, and the `.env*` pattern covers it. (See F1 for non-secret local data that would be committed.)
11. **Fixture clean:** N/A. No `fixtures/sample-session.jsonl` yet (ticket 07).
12. **Rate limit key not client controlled:** N/A. No route handler yet (ticket 10).

## End to end validation (every boundary)

- Source data: N/A (no fixture)
- Input: N/A (no route)
- **Secret key:** PASS. Env-only, git-ignored, example file empty (same evidence as check 3).
- System prompt: N/A
- AI output schema: N/A
- API failures: N/A
- Display: N/A

## Prompt injection note

N/A. No log text reaches a prompt yet.

## Ticket 00 acceptance criteria

- **A1 · Next.js app serves a placeholder page:** PASS. `app/page.tsx` renders a placeholder with the project line, and `package.json` has `dev`/`build`/`start`. (The verifier doesn't run builds; Joseph confirms with `npm run dev` at step 6.)
- **A2 · Vitest + one passing test; typecheck and lint clean:** PASS on code. `vitest` ^5.0.5 is in devDependencies, `lib/aiMode.test.ts` has 3 tests, and `typecheck`/`lint`/`test` scripts exist. The pass results are builder-reported, not re-run here.
- **A3 · `.env*` git-ignored:** PASS on the pattern (`.gitignore` lines 33–35). The `git check-ignore -v .env.local` confirmation that Session state says happens before the first commit is still Joseph's to run.
- **A4 · `AI_MODE` defaults to mock; example env file with no real values:** PASS. `lib/aiMode.ts` returns `"live"` only for the exact string `live`; tests cover unset, `LIVE` and empty. `.env.example` sets `AI_MODE=mock` and holds no real values.
- **A5 · README first line + boundaries:** PASS. Line 1 matches the required sentence exactly; "Boundaries" lists local only, observe and explain only, sample logs only, defender framing, and no real attacker data leaving the machine.
- **A6 · All seven loop steps run:** N/A. This review is step 3; the remaining steps are still to come.
- **A7 · Session state lists changed and new files:** FAIL. Four untracked files created during this ticket are missing from the "New (untracked) files" list: `.claude/activity.jsonl`, `.claude/session.json`, `.claude/timeline.jsonl`, `.claude/usage.json`.

## Other findings

- **F1 · Local session telemetry would be committed:** FAIL. `.claude/activity.jsonl`, `.claude/session.json`, `.claude/timeline.jsonl` and `.claude/usage.json` are not git-ignored. They hold a local transcript path (`/Users/josephclay/.claude/projects/...`), session IDs, scratchpad paths, cost totals and rate-limit usage. None are API keys, but they are machine-local data that a `git add .` would push to the public repo. Fix: add those four paths to `.gitignore` and keep `.claude/progress.txt` tracked (or ignore it too, if Joseph wants).
- **F2 · Undocumented config flags in `next.config.ts`:** FAIL. `cacheComponents: true` and `partialPrefetching: true` are set, and the Session state notes don't mention them. If they aren't the create-next-app 16.4.3 defaults, they change caching and rendering behavior that later route-handler tickets depend on. Fix: the builder confirms whether they came from the scaffold and notes that in Session state, or removes them if it added them.
- **F3 · `REVIEW_LOOP.md` contradicts D10:** FAIL. This file is untracked and marked "Superseded", but its loop step 7 says "BUILDER: commit now", the opposite of D10 and the hard rule that only Joseph commits. Once committed, a future builder session could read and follow it. Fix (Joseph's call, since it's his source file): move it into `context/` (git-ignored), or leave it out of the commit.

## Notes (no action needed)

- `@types/node` was raised from ^20 to ^22 to match Vitest's peer range; Session state documents this.
- `AGENTS.md` comes from `next dev` and is listed in Session state.
- `app/layout.tsx` loads two Geist fonts (sans + mono). D2's "one font family" applies to the dashboard ticket, not this placeholder.
- `CLAUDE.md`, `EVIDENCE.md`, `GLOSSARY.md`, `VERIFIER_PROMPT.md` and `docs/spec.md` are pre-existing project docs, not builder output, so their absence from the new-files list is expected.

## Must fix before commit

- [ ] **A7** · Add the four `.claude/*.json*` telemetry files to Session state (or note them as ignored after F1). `[approve] / [skip]`
- [ ] **F1** · Git-ignore `.claude/activity.jsonl`, `.claude/session.json`, `.claude/timeline.jsonl`, `.claude/usage.json`. `[approve] / [skip]`
- [ ] **F2** · Confirm the source of `cacheComponents` / `partialPrefetching` in `next.config.ts` and note it in Session state, or remove them. `[approve] / [skip]`
- [ ] **F3** · Keep the superseded `REVIEW_LOOP.md` out of the commit (move to `context/` or leave unstaged). `[approve] / [skip]`

Totals: 8 PASS / 4 FAIL (N/A items not counted).
