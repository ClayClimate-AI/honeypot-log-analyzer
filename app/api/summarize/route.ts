import { getAiClient } from "../../../lib/aiClient";
import { getAiMode } from "../../../lib/aiMode";
import { costUsd } from "../../../lib/cost";
import { checkExcerpt } from "../../../lib/inputGuard";
import { buildUserMessage, SYSTEM_PROMPT } from "../../../lib/prompt";

// The only server entry point and the only place the AI is called (D1).
// browser → this route → input guard → AI client (mock or live) → screen.
// Still to come in later issues: Zod output guard and failure mapping (#10),
// rate limit (#12).
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

  const reply = await getAiClient(mode)({
    system: SYSTEM_PROMPT,
    userMessage: buildUserMessage(excerpt),
  });
  const { summary, threatLabel } = JSON.parse(reply.text);

  return Response.json({
    summary,
    threatLabel,
    mode,
    usage: reply.usage,
    costUsd: costUsd(reply.usage),
  });
}
