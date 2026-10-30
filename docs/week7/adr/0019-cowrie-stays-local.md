# D19 · Cowrie stays local; the app uses sanitized samples
Status: Accepted when signed by Joseph below
Context: A cloud honeypot would give live data but adds an internet facing target, real IPs and 6 to 12 h of work.
Decision: Cowrie runs only in local Docker (127.0.0.1:2222, offline lab). The deployed app uses sanitized samples (203.0.113.x) and user pastes. Fresh capture batches are a later option.
Consequences: No live feed in the demo; zero new exposure; no Cowrie dependency in the build.
Signed: ____________________ Date: ________

## RCA (root cause analysis, Joseph writes)
- Problem or risk that led to this decision:
- Root cause (why it happens):
- Why this decision fixes the root cause:
- How I will know it worked:
