/**
 * @file tests/unit/lib/signed-in-marker.test.ts
 * @desc The readable "signed in" marker cookie: its name, reading it, clearing it, and its
 *       lifetime.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import {
  clearSignedInMarker,
  hasSignedInMarker,
  markerMaxAge,
  SIGNED_IN_COOKIE,
} from "@/lib/signed-in-marker";

describe("signed-in marker", () => {
  it("is named pools-signed-in", () => {
    expect(SIGNED_IN_COOKIE).toBe("pools-signed-in");
  });

  it.each([
    ["pools-signed-in=1", true],
    ["a=b; pools-signed-in=1; c=d", true],
    ["pools-signed-in=0", false],
    ["xpools-signed-in=1", false],
    ["", false],
  ])("reads %j as %s", (cookie, expected) => {
    expect(hasSignedInMarker(cookie)).toBe(expected);
  });

  it("lives until the session expires, never negative", () => {
    const now = Date.parse("2026-09-27T00:00:00Z");
    expect(markerMaxAge("2026-10-04T00:00:00Z", now)).toBe(7 * 24 * 60 * 60);
    expect(markerMaxAge(new Date(now - 1000), now)).toBe(0);
  });

  it("clears itself by expiring", () => {
    const target = { cookie: "" };
    clearSignedInMarker(target);
    expect(target.cookie).toBe("pools-signed-in=; Path=/; Max-Age=0; SameSite=Lax");
  });
});
