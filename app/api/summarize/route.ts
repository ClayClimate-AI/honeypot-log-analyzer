import { getAiClient } from "../../../lib/aiClient";
import { getAiMode } from "../../../lib/aiMode";

// The only server entry point and the only place the AI is called (D1).
// Tracer bullet (#3): browser → this route → AI client (mock) → screen.
// Still to come in later issues: input guard (#8), Zod output guard and
// failure mapping (#10), rate limit (#12), cost from usage × prices (#5).
export async function POST(request: Request) {
  // Mode comes only from the server env, never from the request (D9).
  const mode = getAiMode();

  const body = await request.json();
  const excerpt = typeof body?.excerpt === "string" ? body.excerpt : "";

  const reply = await getAiClient(mode)({ excerpt });
  const { summary, threatLabel } = JSON.parse(reply.text);

  return Response.json({
    summary,
    threatLabel,
    mode,
    usage: reply.usage,
    // #5 computes this on the server from usage × dated price constants.
    costUsd: 0,
  });
}
