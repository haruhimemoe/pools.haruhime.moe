/**
 * @file tests/unit/config/headers.test.ts
 * @desc Security headers on every route (no framing, no MIME sniffing, a trimmed Referer, images from here and osu!'s avatar and cover hosts, preview clips from
 *       osu!'s CDN only) and no
 *       X-Powered-By.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

const catchAll = async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((entry) => entry.source === "/:path*");
  return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]));
};

describe("security headers", () => {
  it("sends the security headers on every route", async () => {
    expect(await catchAll()).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "frame-ancestors 'none'; img-src 'self' data: https://a.ppy.sh https://osu.ppy.sh https://assets.ppy.sh; media-src https://b.ppy.sh",
    });
  });

  it("lets map covers and preview clips load from osu!'s CDN, and nothing else plays", async () => {
    const csp = (await catchAll())["Content-Security-Policy"] ?? "";
    const directive = (name: string) =>
      csp
        .split(";")
        .map((part) => part.trim().split(" "))
        .find(([key]) => key === name)
        ?.slice(1) ?? [];
    expect(directive("img-src")).toContain("https://assets.ppy.sh");
    expect(directive("media-src")).toContain("https://b.ppy.sh");
  });

  it("doesn't advertise Next.js", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
