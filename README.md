Defensive learning project: a local SSH honeypot plus an AI that summarizes attacker behavior for defenders.

# Cowrie Log Summarizer

A Next.js app that sends a capped excerpt of a [Cowrie](https://github.com/cowrie/cowrie) SSH honeypot log to an AI model and shows a short summary and threat label for a security analyst. Week 6 project ("Add a Reliable AI Feature").

## Boundaries

- **Local only.** Cowrie runs in Docker on my own machine and is never exposed to the internet. Test sessions are me SSHing into localhost.
- **Observe and explain only.** No scanning other machines, no exploit code, no attack tooling, no collecting other people's credentials.
- **Sample logs only.** The public site shows sanitized sample logs (documentation IP ranges, reserved domains, default passwords). The honeypot itself is never reachable from the site.
- **Defender framing.** The AI summarizes what happened, what it means, and what to watch. It never explains how to attack.
- **No real attacker data leaves the machine,** except the capped excerpt sent to the AI API for summarization.

## Run locally

```bash
npm install
cp .env.example .env.local   # keep AI_MODE=mock until a ticket needs a live call
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm run typecheck
npm run lint
npm test
```

## Secrets

The API key lives only in `.env.local` (git-ignored) and in Netlify environment variables when deployed. `.env.example` holds no real values. `AI_MODE` defaults to `mock` when unset.
