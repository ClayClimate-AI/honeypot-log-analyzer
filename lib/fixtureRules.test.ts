import { describe, expect, it } from "vitest";
import {
  findCommandProblems,
  findIpv6,
  findUnsafeHosts,
  isDocumentationIp,
  isPrivateIp,
  isReservedHost,
} from "./fixtureRules.mts";

// Proves the rules catch what they claim to, so a clean fixture test means
// something (a regex that matched nothing would also pass it).

describe("isReservedHost", () => {
  it.each(["example.com", "x.example.com", "EXAMPLE.COM", "update.invalid"])("accepts %s", (host) => {
    expect(isReservedHost(host)).toBe(true);
  });

  it.each(["bad.su", "bad.tk", "example.com.evil.ru", "notexample.com", "invalid.com"])(
    "rejects %s",
    (host) => {
      expect(isReservedHost(host)).toBe(false);
    },
  );
});

describe("findUnsafeHosts", () => {
  it.each([
    ["bad.su", "ping bad.su"],
    ["bad.tk", "curl bad.tk/x"],
    ["bad.zip", "wget http://bad.zip/a"],
    ["a URL host with a file ending", "wget http://payload.sh/a"],
  ])("flags %s", (_name, command) => {
    expect(findUnsafeHosts(command)).not.toEqual([]);
  });

  it.each([
    ["example.com", "curl http://example.com/a"],
    [".invalid", "wget http://update.invalid/x.sh"],
    ["file names", "chmod +x run.sh && tar xzf a.tar.gz && cat notes.txt"],
    ["version numbers and IPs", "apt install foo=1.2.3; ping 203.0.113.5"],
  ])("allows %s", (_name, command) => {
    expect(findUnsafeHosts(command)).toEqual([]);
  });
});

describe("findIpv6", () => {
  it.each(["::1", "::ffff:192.168.65.1", "fe80::1", "2001:0db8:0000:0000:0000:0000:0000:0001"])(
    "flags %s",
    (address) => {
      expect(findIpv6(`ping ${address}`)).not.toEqual([]);
    },
  );

  it("ignores times of day", () => {
    expect(findIpv6("date -s 14:00:05")).toEqual([]);
  });
});

describe("IPv4 ranges", () => {
  it("accepts only the two documentation ranges", () => {
    expect(isDocumentationIp("203.0.113.10")).toBe(true);
    expect(isDocumentationIp("198.51.100.7")).toBe(true);
    expect(isDocumentationIp("192.0.2.1")).toBe(false);
    expect(isDocumentationIp("192.168.65.1")).toBe(false);
  });

  it.each(["10.0.0.1", "127.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.65.1"])(
    "treats %s as private",
    (ip) => {
      expect(isPrivateIp(ip)).toBe(true);
    },
  );

  it.each(["172.15.0.1", "172.32.0.1", "203.0.113.10"])("treats %s as not private", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe("findCommandProblems", () => {
  it("names a private IP, an IPv6 address and an unsafe host", () => {
    expect(findCommandProblems("ssh 192.168.65.1; ping ::1; curl bad.su")).toHaveLength(3);
  });

  it("passes a clean command", () => {
    expect(findCommandProblems("uname -a; wget http://update.invalid/x.sh")).toEqual([]);
  });
});
