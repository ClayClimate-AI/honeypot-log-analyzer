import { getAiClient } from "../../../lib/aiClient";
import { getAiMode } from "../../../lib/aiMode";
import { costUsd } from "../../../lib/cost";
import { buildUserMessage, SYSTEM_PROMPT } from "../../../lib/prompt";

// The only server entry point and the only place the AI is called (D1).
// browser → this route → AI client (mock or live) → screen.
// Still to come in later issues: input guard (#8), Zod output guard and
// failure mapping (#10), rate limit (#12).
export async function POST(request: Request) {
  // Mode comes only from the server env, never from the request (D9).
  const mode = getAiMode();

  const body = await request.json();
  const excerpt = typeof body?.excerpt === "string" ? body.excerpt : "";

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
