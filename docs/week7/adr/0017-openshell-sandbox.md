# D17 · The builder runs inside an OpenShell sandbox on Joseph's Mac
Status: Accepted when signed by Joseph below
Context: A coding agent with keys and network access can be tricked by text in logs or docs. OpenShell 0.1.6 gives deny by default egress, OCSF deny logs and credential placeholders. Proven on Joseph's Mac on Oct 30 2026 (docs/week7/OPENSHELL_MAC_GUIDE.md), including a real-key check.
Decision: The Week 7 builder (Claude Code) runs inside an OpenShell sandbox on Joseph's Apple Silicon Mac with Docker Desktop (explicit exception to the tools stay off the Mac rule). Gateway on 127.0.0.1 only, bridge supervisor networking. Joseph types his Anthropic key into the gateway provider himself; inside the sandbox it is only an `openshell:resolve:` placeholder bound to api.anthropic.com and /usr/local/bin/claude. Policy is deny by default with named rules only (lab/openshell/policy.yaml: api.github.com for curl, the npm registry and Google Fonts for node). github.com is blocked, so changes leave only through a download Joseph reviews and pushes. The builder never touches the real Neon database. Never on Netlify.
Consequences: Early (0.1.x) tool on his own machine; any new host the build needs is a DENIED line Joseph approves as a named rule; policy file reviewed in #14.
Signed: ____________________ Date: ________

Cut line: if the sandbox fails during the build, Joseph decides whether to continue in a normal Claude Code session; the demo then shows the 4 tests plus the backup recording.

## RCA (root cause analysis, Joseph writes)
- Problem or risk that led to this decision:
- Root cause (why it happens):
- Why this decision fixes the root cause:
- How I will know it worked:
