/**
 * @file tests/unit/lib/api.test.ts
 * @desc pools' wiring of next-kit's route helpers: the same-origin guard (a foreign Origin, such
 *       as packs.haruhime.moe, or a cross-site or same-site Sec-Fetch-Site is refused; our own
 *       origin, previews and server calls pass), and the /check ids parser (1 to 64 valid beatmap
 *       ids, or null).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { CROSS_SITE_REFUSED, parseBeatmapIds, refuseCrossSite } from "@/lib/api";

describe("refuseCrossSite", () => {
  const request = (
    headers: Record<string, string>,
    url = "https://pools.haruhime.moe/api/admin/x",
  ) => new Request(url, { method: "POST", headers });

  it.each([
    [{ origin: "https://evil.example" }],
    [{ origin: "https://packs.haruhime.moe" }],
    [{ "sec-fetch-site": "cross-site" }],
    [{ "sec-fetch-site": "same-site" }],
  ])("refuses %j", async (headers) => {
    const response = refuseCrossSite(request(headers));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({
      error: { code: "forbidden", message: CROSS_SITE_REFUSED },
    });
  });

  it.each([
    [{}],
    [{ origin: "https://pools.haruhime.moe", "sec-fetch-site": "same-origin" }],
    [{ "sec-fetch-site": "none" }],
  ])("lets %j through", (headers) => {
    expect(refuseCrossSite(request(headers))).toBeNull();
  });

  it("lets a preview deployment call itself", () => {
    const url = "https://pools-git-x.vercel.app/api/admin/x";
    expect(refuseCrossSite(request({ origin: "https://pools-git-x.vercel.app" }, url))).toBeNull();
  });
});

describe("parseBeatmapIds", () => {
  it("reads 1 to 64 beatmap ids", () => {
    expect(parseBeatmapIds("75,129891")).toEqual([75, 129891]);
  });

  it.each([
    null,
    "",
    "abc",
    "0",
    "1,,2",
    "2147483648",
    Array.from({ length: 65 }, (_, i) => i + 1).join(","),
    "1".repeat(800),
  ])("refuses %j", (raw) => {
    expect(parseBeatmapIds(raw)).toBeNull();
  });
});
