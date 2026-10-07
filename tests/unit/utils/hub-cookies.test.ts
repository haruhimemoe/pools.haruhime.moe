/**
 * @file tests/unit/utils/hub-cookies.test.ts
 * @desc The hub's cookies for sign-out: only the session cookies are forwarded, the cookie domain
 *       applies only under it (host-only on localhost), and every session cookie plus the marker
 *       is cleared, the __Secure- ones with Secure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { clearHubCookies, cookieDomainFor, sessionCookieHeader } from "@/utils/hub-cookies";

describe("sessionCookieHeader", () => {
  it("keeps only the session cookies", () => {
    expect(
      sessionCookieHeader(
        "a=1; better-auth.session_token=t.s; __Secure-better-auth.session_token=u.v; better-auth.session_data=x; haruhime-signed-in=1",
      ),
    ).toBe("better-auth.session_token=t.s; __Secure-better-auth.session_token=u.v");
  });

  it("is null without one", () => {
    expect(sessionCookieHeader(null)).toBeNull();
    expect(sessionCookieHeader("a=1; xbetter-auth.session_token=t")).toBeNull();
  });
});

describe("cookieDomainFor", () => {
  it("applies the domain to its own hosts only", () => {
    expect(cookieDomainFor("pools.haruhime.moe", ".haruhime.moe")).toBe(".haruhime.moe");
    expect(cookieDomainFor("haruhime.moe", ".haruhime.moe")).toBe(".haruhime.moe");
    expect(cookieDomainFor("localhost", ".haruhime.moe")).toBeNull();
    expect(cookieDomainFor("evilharuhime.moe", ".haruhime.moe")).toBeNull();
  });
});

describe("clearHubCookies", () => {
  it("expires every session cookie and the marker on the domain", () => {
    const lines = clearHubCookies("haruhime-signed-in", ".haruhime.moe");
    expect(lines.map((line) => line.split("=")[0])).toEqual([
      "__Secure-better-auth.session_token",
      "better-auth.session_token",
      "__Secure-better-auth.session_data",
      "better-auth.session_data",
      "haruhime-signed-in",
    ]);
    for (const line of lines) {
      expect(line).toContain("Max-Age=0");
      expect(line).toContain("Domain=.haruhime.moe");
      expect(line.includes("Secure;") || line.endsWith("Secure")).toBe(
        line.startsWith("__Secure-"),
      );
    }
  });

  it("leaves Domain off for host-only cookies", () => {
    for (const line of clearHubCookies("haruhime-signed-in", null)) {
      expect(line).not.toContain("Domain");
    }
  });
});
