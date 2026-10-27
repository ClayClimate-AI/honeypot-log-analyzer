// The D3 rules for the public sample fixture, shared by the sanitizer
// (scripts/sanitize-cowrie.mts, which fails at the source) and the fixture
// test (which checks the committed file). The fixture ships in the browser
// bundle, so these rules are about it revealing nothing about Joseph's
// honeypot, Mac or network. This is a .mts file so Node can run the
// sanitizer without a package-wide "type": "module".

export const ALLOWED_FIELDS = [
  "eventid",
  "timestamp",
  "src_ip",
  "username",
  "password",
  "input",
  "duration",
] as const;

export const DEFAULT_PASSWORDS = new Set(["123456", "admin"]);
// A bare `ssh localhost` sends the Mac's login name, so only defaults pass.
export const DEFAULT_USERNAMES = new Set(["root", "admin"]);
export const FIXTURE_MAX_CHARS = 3000;

// Dotted tokens with these endings are file names, not hosts. URL hosts get
// no such pass.
const FILE_ENDINGS = new Set(["sh", "py", "txt", "gz", "tar", "log", "conf", "json"]);

const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const IPV6_CANDIDATE = /[0-9a-f]*(?::[0-9a-f]*){2,}/gi;
const URL_HOST = /[a-z][a-z0-9+.-]*:\/\/([^/\s:'"]+)/gi;
const DOTTED_TOKEN = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi;

export function isDocumentationIp(ip: string): boolean {
  return ip.startsWith("203.0.113.") || ip.startsWith("198.51.100.");
}

export function isPrivateIp(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function isReservedHost(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === "example.com" || lower.endsWith(".example.com") || lower.endsWith(".invalid");
}

export function findIpv4(text: string): string[] {
  return text.match(IPV4) ?? [];
}

// Anything shaped like an IPv6 address: it has "::" or the full 7 colons.
// Times like 14:00:05 have neither.
export function findIpv6(text: string): string[] {
  return (text.match(IPV6_CANDIDATE) ?? []).filter(
    (token) => token.includes("::") || token.split(":").length - 1 >= 7,
  );
}

// Hosts that are not example.com, *.example.com or *.invalid: every URL host,
// plus any bare dotted token whose last part is letters only (so IPs and
// version numbers are left to the IP checks) and isn't a file ending.
export function findUnsafeHosts(text: string): string[] {
  const urlHosts = [...text.matchAll(URL_HOST)].map(([, host]) => host);
  const bareHosts = (text.match(DOTTED_TOKEN) ?? []).filter((token) => {
    const last = token.split(".").pop() ?? "";
    return /^[a-z]+$/i.test(last) && !FILE_ENDINGS.has(last.toLowerCase());
  });
  return [...urlHosts, ...bareHosts].filter((host) => !isReservedHost(host));
}

// Everything wrong with one command line, as messages that name the problem
// value. Commands are attacker text, not secrets, so naming them is safe.
export function findCommandProblems(input: string): string[] {
  const problems: string[] = [];
  for (const ip of findIpv4(input)) {
    if (!isDocumentationIp(ip)) {
      problems.push(`command contains ${ip}, which is not a documentation IP.`);
    }
  }
  for (const ip of findIpv6(input)) {
    problems.push(`command contains ${ip}, which looks like an IPv6 address.`);
  }
  for (const host of findUnsafeHosts(input)) {
    problems.push(`command contains host ${host}; use example.com or .invalid.`);
  }
  return problems;
}
