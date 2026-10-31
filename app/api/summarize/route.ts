import { getAiClient, type AiReply } from "../../../lib/aiClient";
import { mapAiError } from "../../../lib/aiFailure";
import { getAiMode } from "../../../lib/aiMode";
import { costUsd } from "../../../lib/cost";
import { checkExcerpt } from "../../../lib/inputGuard";
import { BAD_OUTPUT_MESSAGE, checkAiReply } from "../../../lib/outputGuard";
import { buildUserMessage, SYSTEM_PROMPT } from "../../../lib/prompt";
import {
  checkRateLimit,
  clientKey,
  rateLimitMessage,
  takeRateLimit,
  type RateCheck,
} from "../../../lib/rateLimit";
import { buildSavedRun, saveRunSafely } from "../../../lib/runStore";

function tooManyRequests(check: Extract<RateCheck, { ok: false }>): Response {
  return Response.json(
    { error: rateLimitMessage(check.retryAfterSeconds), retryAfterSeconds: check.retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(check.retryAfterSeconds) } },
  );
}

// The only server entry point and the only place the AI is called (D1).
// browser → this route → rate limit check → input guard → rate limit taken →
// AI client (mock or live) → failure guard → output guard → save (live
// only) → screen.
export async function POST(request: Request) {
  // Mode comes only from the server env, never from the request (D9).
  const mode = getAiMode();

  // Rate limit first (D8). The key comes only from Netlify's connection IP
  // header; this log line says whether it arrived, never what it was.
  const client = clientKey(request.headers);
  console.info("rate_limit_key", { ipHeaderPresent: client.ipHeaderPresent });
  const limit = checkRateLimit(client.key);
  if (!limit.ok) {
    return tooManyRequests(limit);
  }

  // A body that isn't JSON counts as an empty excerpt, so it gets the same 400.
  const body = await request.json().catch(() => null);
  const excerpt = typeof body?.excerpt === "string" ? body.excerpt : "";

  // Validate first, call second (D6). This decision is final; the browser's
  // checks are only for fast feedback. A rejection here doesn't use up the
  // minute.
  const check = checkExcerpt(excerpt);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  // The minute is used up only by a request that reaches the AI call.
  const taken = takeRateLimit(client.key);
  if (!taken.ok) {
    return tooManyRequests(taken);
  }

  // Failure guard (D7): the log gets a short code, the visitor a friendly
  // message. The error object itself is never logged or returned.
  const startedAt = Date.now();
  let reply: AiReply;
  try {
    reply = await getAiClient(mode)({
      system: SYSTEM_PROMPT,
      userMessage: buildUserMessage(excerpt),
    });
  } catch (error) {
    const failure = mapAiError(error, Date.now() - startedAt);
    console.error(failure.code, failure.logDetail);
    return Response.json({ error: failure.message }, { status: failure.httpStatus });
  }

  // Output guard (D5): nothing reaches the screen unless it passes the schema.
  const output = checkAiReply(reply);
  if (!output.ok) {
    console.error("ai_bad_output", { reason: output.reason });
    return Response.json({ error: BAD_OUTPUT_MESSAGE }, { status: 502 });
  }

  // Save only after the output guard passes, and only live runs (D18). The
  // saved copy has attacker IPs redacted and no raw excerpt. A database
  // failure is logged and the summary is still returned.
  if (mode === "live") {
    await saveRunSafely(
      buildSavedRun({
        summary: output.value.summary,
        threatLabel: output.value.threatLabel,
        usage: reply.usage,
        excerpt,
      }),
    );
  }

  return Response.json({
    summary: output.value.summary,
    threatLabel: output.value.threatLabel,
    mode,
    usage: reply.usage,
    costUsd: costUsd(reply.usage),
  });
}
