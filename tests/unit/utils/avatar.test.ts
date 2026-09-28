/**
 * @file tests/unit/utils/avatar.test.ts
 * @desc Avatars shown only from the hosts the CSP allows for them: osu!'s avatar URLs as its API
 *       sends them (a.ppy.sh, and the guest avatar on osu.ppy.sh, absolute or as a path), on
 *       https, and nothing for any other host.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { avatarSrc } from "@/utils/avatar";

describe("avatarSrc", () => {
  it("keeps osu!'s avatar URLs", () => {
    expect(avatarSrc("https://a.ppy.sh/2?1537409912.jpeg")).toBe(
      "https://a.ppy.sh/2?1537409912.jpeg",
    );
    expect(avatarSrc("https://osu.ppy.sh/images/layout/avatar-guest@2x.png")).toBe(
      "https://osu.ppy.sh/images/layout/avatar-guest@2x.png",
    );
  });

  it("reads a bare path as osu.ppy.sh's and moves http to https", () => {
    expect(avatarSrc("/images/layout/avatar-guest@2x.png")).toBe(
      "https://osu.ppy.sh/images/layout/avatar-guest@2x.png",
    );
    expect(avatarSrc("http://a.ppy.sh/2")).toBe("https://a.ppy.sh/2");
  });

  it("shows nothing from any other host, or for nothing", () => {
    for (const url of [
      "https://example.com/a.png",
      "//example.com/a.png",
      "https://a.ppy.sh.example.com/2",
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      expect(avatarSrc(url)).toBeNull();
    }
  });
});
