import { isIPv4, isIPv6 } from "node:net";

// D18 data boundary: a saved summary may quote attacker commands, but every
// attacker IP becomes "attacker IP" before the row is written. Only the saved
// copy is redacted; the summary on screen is unchanged.
export const IP_PLACEHOLDER = "attacker IP";

// Runs of hex digits, dots and colons with at least one colon. Each run is
// checked with node:net, so times like 03:00:00 are left alone. If the whole
// run isn't an address, colons and dots touching either end (IP:2001:db8::1,
// 2001:db8::1:, a sentence's final dot) are set aside, as few as possible so
// a compressed "::" stays with its address (::1., fe80::.). A word ending in
// a hex letter can pull letters into the run (Code:2001:db8:0:0:0:0:0:1 runs
// from "de:"), so starting just after each colon is tried as well.
const IPV6_CANDIDATE = /[0-9A-Fa-f.]*:[0-9A-Fa-f.:]*/g;
const EDGE_PUNCTUATION = /^([:.]*)(.*?)([:.]*)$/;

// Where an address inside the run may start: the run itself, after each
// leading colon or dot, then just after every later colon. Earliest first,
// so the longest address wins.
function startOffsets(match: string, leadLength: number): number[] {
  const starts = Array.from({ length: leadLength + 1 }, (_, i) => i);
  for (let i = leadLength; i < match.length; i++) {
    if (match[i] === ":") starts.push(i + 1);
  }
  return starts;
}

// Four dotted groups not inside a longer dotted number (so 1.2.3.4.5 is left
// alone), checked with node:net so 999.1.1.1 is left alone too. Dots alone
// before the address (...203.0.113.5) don't block it.
const IPV4_CANDIDATE = /(?<!\d|\d\.)(?:\d{1,3}\.){3}\d{1,3}(?!\d|\.\d)/g;

function redactIpv6(text: string): string {
  return text.replace(IPV6_CANDIDATE, (match) => {
    const [, lead, , trail] = EDGE_PUNCTUATION.exec(match)!;
    for (const start of startOffsets(match, lead.length)) {
      for (let cut = 0; cut <= trail.length; cut++) {
        const end = match.length - cut;
        if (end > start && isIPv6(match.slice(start, end))) {
          return match.slice(0, start) + IP_PLACEHOLDER + match.slice(end);
        }
      }
    }
    return match;
  });
}

// IPv6 first, so an IPv4-mapped address (::ffff:203.0.113.5) is replaced
// whole instead of leaving "::ffff:" behind.
export function redactIps(text: string): string {
  return redactIpv6(text).replace(IPV4_CANDIDATE, (match) =>
    isIPv4(match) ? IP_PLACEHOLDER : match,
  );
}
