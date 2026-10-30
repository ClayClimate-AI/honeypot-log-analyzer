# D20 · One builder inside the sandbox; Joseph pushes and merges
Status: Accepted when signed by Joseph below
Replaces: the earlier draft "Two parallel builders in worktrees" (C9 was finished in 97b276b, so nothing was left to run in parallel).
Context: The Monday Nov 2 10:00 AM CT deadline, plus the move of the builder into an OpenShell sandbox where github.com is blocked.
Decision: One builder, one feature branch per step, in the order in SPEC.md section 3. Inside the sandbox the builder may create its feature branch and commit to it. It never pushes, merges, rebases, force pushes or resets; it cannot reach github.com anyway. At the end of each step it stops; Joseph downloads the repo from the sandbox, reviews the diff, pushes the branch from his Mac, checks CI, and merges. The verifier subagent runs R1 to R6 inside the sandbox and reads the builder's build.log; it never runs build.
Consequences: Joseph's control is the download, review, push and merge of each step instead of making every commit himself; the builder's commits carry the small-commit history; his review of each diff is recorded in the PR and in EVIDENCE.md by him.
Signed: ____________________ Date: ________

## RCA (root cause analysis, Joseph writes)
- Problem or risk that led to this decision:
- Root cause (why it happens):
- Why this decision fixes the root cause:
- How I will know it worked:
