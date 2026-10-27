import { getAiClient, type AiReply } from "../../../lib/aiClient";
import { mapAiError } from "../../../lib/aiFailure";
import { getAiMode } from "../../../lib/aiMode";
import { costUsd } from "../../../lib/cost";
import { checkExcerpt } from "../../../lib/inputGuard";
import { BAD_OUTPUT_MESSAGE, checkAiReply } from "../../../lib/outputGuard";
import { buildUserMessage, SYSTEM_PROMPT } from "../../../lib/prompt";

// The only server entry point and the only place the AI is called (D1).
// browser → this route → input guard → AI client (mock or live) → failure
// guard → output guard → screen. Still to come: rate limit (#12).
export async function POST(request: Request) {
  // Mode comes only from the server env, never from the request (D9).
  const mode = getAiMode();

  // A body that isn't JSON counts as an empty excerpt, so it gets the same 400.
  const body = await request.json().catch(() => null);
  const excerpt = typeof body?.excerpt === "string" ? body.excerpt : "";

  // Validate first, call second (D6). This decision is final; the browser's
  // checks are only for fast feedback.
  const check = checkExcerpt(excerpt);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
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

  return Response.json({
    summary: output.value.summary,
    threatLabel: output.value.threatLabel,
    mode,
    usage: reply.usage,
    costUsd: costUsd(reply.usage),
  });
}
