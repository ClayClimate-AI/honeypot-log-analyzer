// Bad-input guardrail (D6). The route runs checkExcerpt before any AI call and
// its answer is final. The browser repeats only checkExcerptBasics for fast
// feedback. Input over the cap is rejected, never truncated.

export const MAX_EXCERPT_CHARS = 4000;
export const MAX_UPLOAD_BYTES = 50 * 1024;

export const EMPTY_MESSAGE = "Paste or upload a Cowrie log excerpt first.";
export const NOT_COWRIE_MESSAGE = "This doesn't look like Cowrie JSON log output.";

export function tooLongMessage(length: number): string {
  return `That excerpt is ${length.toLocaleString("en-US")} characters. The limit is ${MAX_EXCERPT_CHARS.toLocaleString("en-US")}, so trim it and try again.`;
}

export function uploadTooLargeMessage(bytes: number): string {
  return `That file is ${Math.ceil(bytes / 1024).toLocaleString("en-US")} KB. The upload limit is ${MAX_UPLOAD_BYTES / 1024} KB.`;
}

export type InputCheck = { ok: true } | { ok: false; error: string };

// Empty and length checks only; safe to run in the browser.
export function checkExcerptBasics(excerpt: string): InputCheck {
  if (excerpt.trim() === "") {
    return { ok: false, error: EMPTY_MESSAGE };
  }
  if (excerpt.length > MAX_EXCERPT_CHARS) {
    return { ok: false, error: tooLongMessage(excerpt.length) };
  }
  return { ok: true };
}

// True when the line is a JSON object whose eventid starts with "cowrie.".
function isCowrieEvent(line: string): boolean {
  try {
    const event: unknown = JSON.parse(line);
    if (typeof event !== "object" || event === null || Array.isArray(event)) {
      return false;
    }
    const { eventid } = event as { eventid?: unknown };
    return typeof eventid === "string" && eventid.startsWith("cowrie.");
  } catch {
    return false;
  }
}

// The full server-side check. Length runs before the Cowrie check, so an
// oversized input is never parsed.
export function checkExcerpt(excerpt: string): InputCheck {
  const basics = checkExcerptBasics(excerpt);
  if (!basics.ok) {
    return basics;
  }
  if (!excerpt.split(/\r?\n/).some((line) => isCowrieEvent(line.trim()))) {
    return { ok: false, error: NOT_COWRIE_MESSAGE };
  }
  return { ok: true };
}
