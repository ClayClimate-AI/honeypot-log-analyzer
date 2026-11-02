# HITL feedback (#18)

Live site: https://honeypot-log-analyzer.netlify.app (sample logs only)

## Tester 1

- **Who / role:** Joseph (builder, self test)
- **Date and time (CT):** Sun Nov 1 2026, 8:08 PM CT
- **Device and browser:** macOS, Safari
- **What they did:** Load sample logs
- **Live AI pill showing?** yes
- **What they expected to see:** A threat summary with token count, cost, and threat level. Everything that was seen.
- **What they saw:** summary, threat label high, cost shown. Source 203.0.113.10 failed several root logins, then logged in as root, read /etc/passwd, and tried a wget script download. The injected text in the wget line was treated as data. Tokens in 1,192, out 1,037, cost $0.000638.
- **Anything confusing or broken:** Nothing confusing or broken. The guardrail held and the summary matched what was in the logs.
- **Did the rate-limit message make sense?** didn't hit it
- **One thing they'd change:** The feedback loop. After the summary loads there is no obvious next step for what to do with it, so a short prompt on where to go next would help.
- **Joseph's note (what I'll do with this):** What stood out most was that there is nothing to indicate what to do after the summary. Also, there are no user profiles, which would be a lot more work than anticipated, so that is for another day.

## Tester 2

- **Who / role:** TBD (first name or role only)
- **Date and time (CT):** TBD
- **Device and browser:** TBD
- **What they did:** Load sample logs
- **Live AI pill showing?** yes / no
- **What they expected to see:** TBD
- **What they saw:** summary, threat label (low / medium / high / unknown), cost shown
- **Anything confusing or broken:** TBD
- **Did the rate-limit message make sense?** yes / no / didn't hit it
- **One thing they'd change:** TBD
- **Joseph's note (what I'll do with this):** TBD
