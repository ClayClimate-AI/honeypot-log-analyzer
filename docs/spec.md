# Spec: Cowrie AI Summarizer (Week 6)

> Source: the grill signed off Oct 24 2026 (CLAUDE.md §8, D1 to D16). Written locally first; to be published as GitHub issue #1 in https://github.com/ClayClimate-AI/honeypot-log-analyzer with the `ready-for-agent` label once Joseph says yes. Terms follow GLOSSARY.md.

## Problem Statement

A security analyst looking at honeypot output sees a wall of JSON events: login attempts, recon commands, payload downloads, disconnects. Reading a whole session by hand to answer "what happened, what does it mean, what should I watch for?" is slow, and it's harder still for someone learning the security side, like Joseph coming from building automation and HVAC controls.

Speed matters because a honeypot works as an early warning. No legitimate user has a reason to touch it, so any session is a signal. In building automation, a fake BACnet controller on the network gets touched first and alerts you before the real equipment is reached. Cowrie plays the same role for the SSH side: an attacker who reaches the honeypot shows their credentials, recon and payloads before reaching a real gateway or supervisory station. The warning only pays off if a defender can read it quickly.

Putting an AI in front of those logs creates its own problems. The text the AI reads is written by attackers, so it can contain instructions aimed at the AI (prompt injection). The AI can return something wrong, badly formatted, or a refusal. The AI service can be slow, down, or rate limited. Every call costs money, and a public demo site with an API key behind it can be abused. The honeypot data itself must never leak anything about Joseph's own setup.

Joseph needs to show, on a live site from his work computer, one AI feature that holds up when things go wrong, and he needs to explain its data flow, its cost and its failure mode.

## Solution

A minimal dark dashboard (Next.js on Netlify). The user pastes, uploads or loads a **log excerpt** from a Cowrie **honeypot**, clicks Summarize, and gets back:

- a short plain-text **summary** written for a defender (what happened, what it means, what to watch),
- a **threat label** (low, medium, high, or unknown when the excerpt is too unclear to judge),
- an "AI generated · verify before acting" label,
- the measured token usage and cost of that call.

The AI call happens only on the server, and three guardrails surround it:

- **Bad input:** rejects empty, oversized or non-Cowrie text before any AI call.
- **Bad output:** validates the AI's reply against a strict schema and shows a friendly fallback when it fails.
- **Failure:** an 8-second timeout plus friendly messages for timeouts, outages, auth errors and provider rate limits.

A one-request-per-minute limit per client protects the key. The public site only ever shows a **sanitized** **sample fixture** built from Joseph's own local sessions; the honeypot itself is never exposed. A mock mode lets the whole pipeline run and be tested without spending tokens.

## User Stories

### Summarizing
1. As a security analyst, I want to paste a Cowrie log excerpt and click Summarize, so that I get a short explanation without reading every event.
2. As a security analyst, I want the summary to cover what happened, what it means and what to watch, so that I can decide what to do next.
3. As a security analyst, I want a threat label of low, medium, high or unknown, so that I can triage at a glance.
4. As a security analyst, I want the label to say unknown when the excerpt is gibberish, off-topic or too thin, so that the AI says it's unsure instead of guessing.
5. As a security analyst, I want the summary to stick to facts that are in the excerpt, so that I'm not misled by invented details.
6. As a security analyst, I want the summary to be at most three sentences and 600 characters, so that it stays scannable.
7. As a security analyst, I want the summary to be written from a defender's point of view, never as attack instructions, so that the tool stays defensive.
8. As a defender treating the honeypot as an early warning, I want a fast read of what the attacker tried, so that I can check the real equipment before it's reached.
9. As a visitor, I want to upload a log file instead of pasting, so that I don't have to copy large text by hand.
10. As a visitor, I want an uploaded file to fill the same text box as a paste, so that I can see and edit what will be sent.
11. As a visitor without a honeypot, I want a "Load sample logs" button, so that I can try the summarizer right away.
12. As a visitor, I want the loaded sample to go through the same checks as a paste, so that the demo shows the real path.

### Bad input
13. As a visitor, I want an empty or whitespace-only submission to be rejected with "Paste or upload a Cowrie log excerpt first.", so that I know what to do.
14. As a visitor, I want an excerpt over 4,000 characters to be rejected with the actual character count, so that I know how much to trim.
15. As the site owner, I want oversized excerpts rejected, never silently truncated, so that the AI never summarizes a partial session as if it were whole.
16. As a visitor, I want text that contains no Cowrie event to be rejected with "This doesn't look like Cowrie JSON log output.", so that I don't waste a request on the wrong input.
17. As a visitor, I want an upload over 50 KB to be rejected in the browser before it's read, so that the page stays responsive.
18. As a visitor, I want fast feedback in the browser for empty or oversized text, so that I don't wait on the server for obvious mistakes.
19. As the site owner, I want the server to repeat every input check, so that a crafted request can't skip the browser checks.
20. As the site owner, I want input rejections not to use up the per-minute limit, so that a typo doesn't lock a visitor out.

### Prompt injection (main failure mode)
21. As the site owner, I want the log excerpt to reach the AI wrapped as clearly marked untrusted data, so that attacker-written text is described, not obeyed.
22. As the site owner, I want the system prompt to state that the wrapped content is attacker data and never instructions, so that a crafted command line can't redirect the AI.
23. As a security analyst, I want a summary of a session containing an injection attempt to call that attempt out, so that I learn the attacker tried to manipulate tooling.
24. As Joseph, I want the sample fixture to include one injection-style command line, so that the demo shows the failure mode on real-looking data.
25. As the site owner, I want any reply that ignores the format rules to be rejected by the output check, so that a successful injection still can't put arbitrary content on screen.

### Bad output
26. As the site owner, I want every AI reply checked against a strict schema (a summary and a threat label) before display, so that only well-formed results reach the screen.
27. As a visitor, I want invalid JSON, missing fields, unknown labels, or empty or too-long summaries replaced by "Couldn't produce a reliable summary for this excerpt.", so that I never see broken output.
28. As the site owner, I want an AI refusal treated the same as bad output, so that the visitor gets the same friendly fallback.
29. As the site owner, I want the summary rendered as plain text, never HTML, so that AI output can't inject markup into the page.

### Failure and slowness
30. As a visitor, I want a slow AI call to stop after 8 seconds with "The AI didn't respond in time. Your log text is still here; try again in a moment.", so that I'm not left waiting.
31. As the site owner, I want the timeout to fire before Netlify's function time limit, so that my friendly message always wins over a platform error.
32. As the site owner, I want no automatic retries on the AI call, so that the timeout is predictable.
33. As a visitor, I want a provider rate limit to show "The AI service is busy. Try again in a minute.", so that I know it's temporary.
34. As a visitor, I want an outage or connection error to show the same message as a timeout, so that I get one clear instruction.
35. As the site owner, I want an auth error logged as an auth error but shown as the generic timeout message, so that visitors learn nothing about my credentials.
36. As the site owner, I want each failure logged with a short code (ai_timeout, ai_rate_limited, ai_unavailable, ai_auth_error, ai_bad_output) plus elapsed time, status or reason, so that I can debug from the logs.
37. As the site owner, I want logs never to contain the API key, request headers or raw client IPs, so that logs are safe to read and share.
38. As a visitor, I want the rest of the page to keep working after any failure (my text stays, the previous summary stays, the sample and upload still work), so that one failure doesn't break my session.

### Rate limit
39. As the site owner, I want at most one summary per minute per client, so that one visitor can't run up my bill.
40. As a visitor over the limit, I want "Only one summary per minute. Try again in about N seconds.", so that I know when I can retry.
41. As a visitor over the limit, I want the Summarize button disabled until the wait is over, so that I don't click uselessly.
42. As the site owner, I want the client identity to come only from Netlify's own connection-IP header, so that visitors can't dodge the limit by forging common forwarding headers.
43. As the site owner, I want a missing connection-IP header to fall into one shared bucket, so that a missing header tightens the limit instead of loosening it.
44. As the site owner, I want the client IP hashed before storage and never logged, so that I don't keep visitors' IPs.
45. As the site owner, I want the deploy ticket to prove with two forged-header requests that the second gets a 429, so that I know the limit holds on the real platform.
46. As the site owner, I want the deployed route to log only whether the IP header was present, so that I can confirm the header arrives without recording any IP.
47. As the site owner, I want the per-instance, in-memory nature of the limit documented as a known limitation, with the workspace spend cap as the hard backstop, so that the risk is stated honestly.

### Cost
48. As a visitor, I want a cost note before I submit ("Cap: 4,000 characters · about $0.0001–$0.0003 per call (Claude Haiku 5.5) · measured cost shown after each call"), so that I know the feature is capped and cheap.
49. As a visitor, I want the measured input and output tokens and that call's cost shown after a summary, so that the cost is real, not guessed.
50. As the site owner, I want cost calculated on the server from the reported usage and dated price constants, so that the figure is traceable and easy to update.
51. As the site owner, I want the key in a dedicated workspace with about a $5 monthly spend limit, so that a leaked key or abuse has a hard ceiling.
52. As the site owner, I want the AI to use the low effort setting, so that hidden thinking tokens don't inflate output cost.

### Mock mode
53. As the builder, I want a server-only mode switch (mock or live, mock when unset), so that development and tests spend no tokens by default.
54. As the builder, I want a scenario switch (success, bad output, timeout, rate limited, refusal), so that I can trigger each guardrail on demand.
55. As the builder, I want mock mode to replace only the AI provider call, so that the schema check, error mapping and rate limit run exactly as in live mode.
56. As a visitor, I want a "Mock AI" (amber) or "Live AI" (green) pill in the header, so that I always know whether results are real.
57. As the builder, I want each response to include its mode and show zero tokens in mock, so that I can confirm mock is off before a real ticket.
58. As Joseph, I want the browser never to be able to switch modes or scenarios, so that visitors can't force a behavior on the live site.

### Sample fixture and sanitization
59. As Joseph, I want the sample fixture to keep only allowlisted fields (eventid, timestamp, src_ip, username, password, input, duration), so that it reveals nothing about my sensor or client setup.
60. As Joseph, I want all IPs in the fixture from documentation ranges (203.0.113.0/24, 198.51.100.0/24), so that no real address is published.
61. As Joseph, I want only reserved domains (example.com, .invalid), one fixed fake date and obvious default passwords in the fixture, so that nothing real leaks.
62. As Joseph, I want the fixture under 3,000 characters with valid JSON on every line, so that it fits the cap and parses cleanly.
63. As Joseph, I want an automated fixture test to enforce these rules, so that a careless edit can't publish unsanitized data.
64. As the site owner, I want the server never to read the fixture by name, so that the fixture takes exactly the same path as any paste.

### Govern and transparency
65. As a visitor, I want "AI generated · verify before acting" above every summary, so that I treat it as a draft.
66. As a visitor, I want the threat badge colored by label (low green, medium amber, high red, unknown grey), so that I can read severity at a glance.
67. As a visitor, I want header pills for "Sample logs only", "Next.js on Netlify" and "1 request / min", so that the site's boundaries are visible.
68. As a visitor, I want a footer stating this is a defensive learning project, that the honeypot is never exposed and that the site uses sanitized sample logs, so that I understand the purpose.

### Look and feel
69. As a visitor, I want a minimal dark dashboard matching the UI sample (one font family, 8 px spacing scale, the sample's color tokens, consistent buttons and cards), so that the site looks deliberate and consistent.
70. As a visitor, I want clear success, rate limit, failure and idle states in the result card, so that I always know what happened.

### Security and repo hygiene
71. As the site owner, I want the API key read only from server environment variables, never sent to the browser and never committed, so that it can't be scraped.
72. As the site owner, I want CI on every push to main to run typecheck, lint, tests and a secret scan, so that a leaked key or broken guardrail is caught right away.
73. As Joseph, I want the README to open with the defensive-project statement and include a data-flow diagram, so that reviewers see the purpose and the AI call first.
74. As Joseph, I want a short mock-mode clip of the bad-output fallback linked from the README, so that I can show the backstop in the demo even though it can't be triggered live.

### Process and control
75. As Joseph, I want every ticket built by a builder session and checked by a separate read-only verifier session, so that a second pair of eyes reviews every diff.
76. As Joseph, I want to be the only one who commits, after reading the review, so that I control every change.
77. As Joseph, I want to paste in the system prompt wording myself, with the builder copying it word for word, so that the graded prompt is my work.
78. As Joseph, I want a Ticket 0 rehearsal on a trivial README change, so that I prove the builder → verifier → me handoff before any real code.

## Implementation Decisions

**Modules**
- **Summarize route** (the only server entry point, a Next.js route handler). It accepts a POST with a JSON body holding the log excerpt and returns JSON. Steps, in order:
  1. read the client identity and check the rate limiter
  2. run the input guard
  3. use up the client's minute
  4. call the AI client
  5. run the output guard
  6. compute the cost
  7. respond
  Any failure maps to a status code and a fixed user message.
- **Input guard:** a pure function from the raw excerpt to an accept, or a reject carrying a user message. It runs three checks:
  - empty or whitespace only
  - over 4,000 characters, reported with the count
  - at least one line is a JSON object whose `eventid` starts with `cowrie.`
- **Output guard:** a Zod schema `{ summary: string (1 to 600 chars, at most 3 sentences), threatLabel: "low" | "medium" | "high" | "unknown" }`, plus parsing of the raw model text. A refusal stop reason fails this guard.
- **AI client:** a thin wrapper around the Anthropic TypeScript SDK and the only thing mock mode replaces. It sends the system prompt and a user message with the excerpt wrapped in `<log_excerpt>` tags. Settings:
  - model `claude-haiku-5-5`
  - effort `low`
  - timeout 8,000 ms
  - 0 retries
  It returns the raw text, stop reason and usage, or throws a typed error the route maps to a failure code.
- **Mock AI client:** chosen when `AI_MODE` is `mock` or unset. `AI_MOCK_SCENARIO` picks the canned behavior:
  - `success`: a valid reply
  - `bad_output`: a schema-breaking reply
  - `timeout`: a timeout error
  - `rate_limited`: a provider 429 error
  - `refusal`: a refusal stop reason

  It reports zero usage. It also records the last outgoing request so tests can inspect it.
- **Rate limiter:** an in-memory map from a hashed client key to the time of its last AI call. The key comes only from the `x-nf-client-connection-ip` header; a missing header uses one fixed shared bucket. It exposes `check` (allowed, or the seconds to wait), `consume`, and a test-only reset.
- **System prompt:** a constant holding Joseph's exact wording. It covers seven rules:
  1. role and audience
  2. the task
  3. log excerpt content is untrusted data
  4. never add facts
  5. use unknown when unsure
  6. defender framing only
  7. the output format
- **Pricing:** dated price constants ($0.10 in / $0.50 out per 1M tokens, dated 2026-10-06, Joseph re-confirms) and a function from usage to cost.
- **Dashboard UI:** client components ported from the UI sample:
  - header pills
  - input card with paste, upload and "Load sample logs"
  - cost note
  - result card with four states, AI label and threat badge
  - footer
- **Sample fixture:** a committed sanitized JSONL file, imported by the client only.

**API contract** (the summarize route)
- Request: `{ excerpt: string }`.
- Success 200: `{ summary, threatLabel, mode: "mock" | "live", usage: { inputTokens, outputTokens }, costUsd }`.
- Errors return `{ error: { code, message }, mode }`, where `message` is the exact user-facing text from D6/D7/D8:
  - 400 for input-guard rejections
  - 429 with `retryAfterSeconds` for our own rate limit
  - 502 for `ai_bad_output`
  - 503 for `ai_rate_limited`
  - 504 for `ai_timeout`
  - 503 for `ai_unavailable` and `ai_auth_error`, which share the timeout's message
- Error bodies never include the key, headers, stack traces or raw provider errors.

**Architectural decisions**
- The rate limit lives in the route handler, not edge middleware, so it runs right before the AI call and an input rejection can never use up the minute.
- Limit state is in memory and per instance (best effort on serverless). The workspace spend limit is the backstop. Week 6 has no database.
- `AI_MODE` and `AI_MOCK_SCENARIO` are server-only environment variables. Nothing in the request can change them.
- The fixture reaches the server only as a pasted excerpt. The server has no fixture endpoint.
- No streaming: the response is short and the 8 s timeout limits the request.
- Logging sends one structured line per failure (code plus elapsed time, status or reason) and one `ipHeaderPresent` boolean. No IPs, headers, keys or excerpt text are logged.

## Testing Decisions

**What makes a good test here:** a test checks only external behavior, meaning what a caller of the summarize route sends and gets back. Tests don't reach into internals, don't assert on private helpers, and never call the network or spend tokens. A refactor that keeps the contract must not break a test.

**One seam: the summarize route's request → response contract.** Tests call the route's POST handler directly with a constructed `Request` (body and headers), run in mock mode with a chosen `AI_MOCK_SCENARIO`, and assert on the status code and JSON body. Tests cover:
- **Input guard:** empty, whitespace, 4,001 characters (the message carries the count), and non-Cowrie text each return 400 with the exact message, and the mock records no AI call.
- **Output guard:** `bad_output` and `refusal` return the bad-output fallback. `success` returns a body that passes the schema, with zero usage and `mode: "mock"`.
- **Failure guard:** `timeout` and `rate_limited` return their exact messages. No error body contains the key, headers or a stack trace.
- **Rate limit (verifier check 12):**
  - two allowed requests with the same connection-IP header: the second gets 429 with `retryAfterSeconds`
  - changing only `x-forwarded-for`, `x-real-ip`, `client-ip` or `forwarded` doesn't escape the limit
  - different connection-IP values get separate buckets
  - with no header, all requests share one bucket
  - an input-guard rejection doesn't use up the minute
- **Prompt injection:** the outgoing request recorded by the mock wraps the excerpt in `<log_excerpt>` tags and carries the system prompt.

**Testability additions:**
- a test-only limiter reset called between tests
- the mock recording its last request

**Fixture test:** a data check on the sample fixture file. It checks:
- allowlisted fields only
- valid JSON on every line
- documentation-range IPs only, with no private ranges
- reserved domains only
- under 3,000 characters
- exactly one injection-style line
- the whole file passes the input guard

**Not automated:** the UI. It's checked by running the app, the verifier's review and the demo. Live mode is checked by hand once (the "Live AI" pill and nonzero tokens) before the first real ticket.

**Tooling and prior art:** Vitest. The repo has no existing tests, so this spec is the pattern. CI runs the suite on every push to main, alongside typecheck, lint and gitleaks.

## Out of Scope

- Any database, saved history, or view/delete of past summaries (Week 7).
- User accounts, auth, or multi-user features.
- Exposing the honeypot, live log streaming, or the server reading Cowrie logs directly.
- Real-time alerting when the honeypot is touched. The early-warning idea motivates the project, but Week 6 only summarizes excerpts on demand.
- Shared or durable rate limiting (Redis, Netlify Blobs, edge middleware).
- Streaming responses, multi-turn chat, or remembered conversation.
- Truncating or chunking oversized excerpts.
- Protocol-level ICS/BACnet honeypots, including a fake BACnet controller (a possible later project).
- Branch protection, PR workflows and deploy previews.
- Automated UI or end-to-end browser tests.
- Any offensive capability: scanning, exploit code, or attack guidance.

## Further Notes

- **Honeypot as an early warning:** a fake BACnet controller on the network gets touched first and alerts you before the real equipment is reached. Cowrie emulates SSH, not BACnet, so this project covers the Linux/SSH side of that idea. A BACnet decoy with alerting is the natural follow-on, outside Week 6.
- **Joseph-owned pieces:** agents never write the system prompt wording (pasted word for word in the AI-call ticket) or anything in EVIDENCE.md.
- **Facts to confirm inside tickets:**
  - the Cowrie host port mapping and the host path of `cowrie.json` (fixture ticket, read-only docker commands with Joseph's OK)
  - the current Netlify function time limit (deploy ticket)
  - the Anthropic Console menu names for workspace spend limits (setup ticket)
- **Actions that need Joseph's explicit yes:** git push, Netlify link and deploy, creating issues, and container start, stop or restart.
- **Ticket 0** rehearses the two-agent loop on a README change in mock mode before any real ticket.
- **Draft ticket order** (for to-tickets):
  0. scaffold + rehearsal
  1. AI call
  2. token/cost
  3. system-prompt change
  4. fixture
  5. input guard
  6. output guard
  7. failure guard
  8. rate limit
  9. UI port
  10. CI
  11. deploy (spoof test, clip)
  12. final code review
