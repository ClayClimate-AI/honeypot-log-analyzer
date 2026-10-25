# Week 6 Evidence (Joseph writes everything here)

**Agents never write, edit, or reword anything in this file.** Each heading notes when its evidence becomes available. Question text is copied from the course pages (CLAUDE.md §3).

---

## Day 4 Build Plan

- My AI feature:
- Likely failure mode:
- My system prompt (role + rule):
- My three guardrails: input / output / failure:

---

## Checks for Understanding

### Day 1: Calling an AI API in Code
_Status from the Atlas screenshot: Q1 to Q4 saved; Q4 to be updated after Exploration 2 (the AI-call ticket, live mode)._

1. Explain what an 'AI API' is by connecting it to the regular APIs you learned in Week 4. What's the same, and what's different about what comes back?
2. In an AI feature, where does the 'system prompt' live, and what does it do? Connect it to what you learned in Week 2.
3. Trace the data flow for 'a user clicks Summarize and sees a summary,' including the AI call. Why does the AI call happen on the back end, not in the browser? Give TWO reasons.
4. From Exploration 2: paste the system prompt you wrote. Was the AI's output actually good? How did you judge it? _(available after the AI-call ticket, live mode)_

### Day 2: Tokens, Cost & Rate Limits

1. Explain tokens as the unit of AI cost. Connect it back to what tokens meant in Week 1. Which costs you money: the input, the output, or both?
2. From Exploration 2: roughly what does one call of your feature cost, and what would 1,000 calls cost? Name one thing you could change to lower it. _(after the token-usage ticket, live mode)_
3. A client asks, 'What happens when 100 people use this at the same time?' Explain rate limits in plain terms and one way your app can handle hitting one without crashing.
4. From Exploration 3: what input cap did you add, and why? How does capping protect you (think about a leaked key or a giant input)? _(after the input-guard ticket)_

### Day 3: Guardrails & Reliability

1. Name the three places an AI feature can fail (input, output, failure) and give a realistic example of each for YOUR feature.
2. From Exploration 1: what happened when you threw bad input at your feature? Which failure did you NOT expect? _(after the break-it pass, before the guardrail tickets)_
3. Why is the AI's output always a 'draft' you should guard before showing a user? Name two ways to guard output (one of them involving the system prompt). Connect to Phase 1.
4. For your Week 6 project: state your feature's failure mode and the specific guardrail you'll build for it. Why does that guardrail matter for a real user?

---

## Prompt Log

### Day 1
1. Exploration 2 agent prompt (that you wrote) + your feature's system prompt. _(AI-call ticket)_
2. Exploration 3 before/after: what one system-prompt change did. _(system-prompt-change ticket)_
3. One idea for the AI feature you'll build for this week's project.

### Day 2
1. Token counts (short vs. long input) and your cost estimate. _(token-usage ticket, live mode)_
2. Exploration 3 prompts + what you capped and how errors are handled. _(input-guard + failure tickets)_
3. One cost/limit consideration for the feature you'll build this week.

### Day 3
1. Your feature's failure modes from Exploration 1 (your break-it list). _(break-it pass)_
2. Exploration 2 + 3 prompts + which guardrails you added and what they caught. _(guardrail tickets)_
3. Week 6 project one-liner: your AI feature + its failure mode + your main guardrail.

### Agent mistake caught
_(any ticket: an approved verifier FAIL, or something you caught in a diff)_

---

## Explained

### Data flow, including the AI call
_(after the AI-call ticket; the README diagram is a builder draft you review)_

### Failure mode + guardrail
_(after the guardrail tickets; main failure mode is prompt injection, backstop is the Zod check, per CLAUDE.md D14)_

### Cost
_(after the token-usage ticket, live mode)_

### Govern
1. Where did you use AI?
2. What did you check?
3. What would you tell a user?

---

## Reflection
