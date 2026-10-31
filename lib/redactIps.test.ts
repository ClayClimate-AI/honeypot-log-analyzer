import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IP_PLACEHOLDER, redactIps } from "./redactIps";

describe("redactIps", () => {
  it("replaces IPv4 addresses, including at the end of a sentence", () => {
    expect(redactIps("Logins from 203.0.113.10 and 198.51.100.7.")).toBe(
      "Logins from attacker IP and attacker IP.",
    );
  });

  it("replaces IPv4 with a port or a CIDR suffix, keeping the suffix", () => {
    expect(redactIps("203.0.113.10:2222 in 203.0.113.0/24")).toBe(
      "attacker IP:2222 in attacker IP/24",
    );
  });

  it("replaces IPv6 addresses, compressed, full and bracketed", () => {
    expect(redactIps("From 2001:db8::1, then [2001:db8:0:0:0:0:0:2]:22.")).toBe(
      "From attacker IP, then [attacker IP]:22.",
    );
  });

  it("replaces an IPv4-mapped IPv6 address whole", () => {
    expect(redactIps("Source ::ffff:203.0.113.5 again")).toBe("Source attacker IP again");
  });

  it("replaces IPv6 right after a colon, keeping the colon", () => {
    expect(redactIps("Seen IP:2001:db8::1 twice")).toBe("Seen IP:attacker IP twice");
  });

  it("replaces IPv6 followed by a colon, keeping the colon", () => {
    expect(redactIps("Source 2001:db8::1: port scan")).toBe("Source attacker IP: port scan");
  });

  it("replaces IPv6 after a word ending in a hex letter, keeping the word", () => {
    expect(redactIps("Code:2001:db8:0:0:0:0:0:1 again")).toBe("Code:attacker IP again");
  });

  it("keeps a compressed :: with its address next to punctuation", () => {
    expect(redactIps("From ::1. Then fe80::. Seen IP:2001:db8::1:")).toBe(
      "From attacker IP. Then attacker IP. Seen IP:attacker IP:",
    );
  });

  it("replaces IPv4 right after dots, keeping the dots", () => {
    expect(redactIps("Then ...203.0.113.5 again")).toBe("Then ...attacker IP again");
  });

  it("leaves times, versions, paths and dotted non-IPs alone", () => {
    const text =
      "At 03:00:00 on 2026-01-15T03:00:20.133Z it ran cat /etc/passwd, uname -a on 5.15.0 and 1.2.3.4.5; 999.1.1.1 is not an IP.";
    expect(redactIps(text)).toBe(text);
  });

  it("leaves text without IPs unchanged", () => {
    expect(redactIps("Several failed root logins, then a success.")).toBe(
      "Several failed root logins, then a success.",
    );
  });

  it("removes every 203.0.113.x address in the sample fixture", () => {
    const fixture = readFileSync("fixtures/sample-session.jsonl", "utf8");
    expect(fixture).toMatch(/203\.0\.113\.\d+/);

    const redacted = redactIps(fixture);

    expect(redacted).not.toMatch(/203\.0\.113\./);
    expect(redacted).toContain(`"src_ip":"${IP_PLACEHOLDER}"`);
  });
});
