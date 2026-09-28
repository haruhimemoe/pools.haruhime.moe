/**
 * @file tests/unit/app/seo.test.ts
 * @desc robots.txt keeps crawlers out of /api, /admin, /signin and /account; the sitemap lists
 *       the static pages (/submit and /data among them), the legal pages (terms included),
 *       current pools, public built pools and used maps (daily); llms.txt is a daily text route.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it, vi } from "vitest";

const DATE = new Date("2026-09-24T12:00:00.000Z");
vi.mock("@/services/pools", () => ({
  listCurrentPools: vi.fn(async () => [
    {
      _id: "otdb-657",
      name: "osu! World Cup 2023 Grand Finals",
      tournament: "osu! World Cup",
      round: "Grand Finals",
      year: 2023,
      updatedAt: DATE,
    },
  ]),
}));
vi.mock("@/services/built-listings", () => ({
  listPublicBuiltPools: vi.fn(async () => [
    {
      id: "b-a0000001",
      name: "My Cup",
      tournament: "",
      round: "",
      year: null,
      maps: 3,
      builtBy: "peppy",
      updatedAt: DATE,
    },
  ]),
}));
vi.mock("@/services/maps", () => ({
  listListedMaps: vi.fn(async () => [
    {
      _id: 129891,
      artist: "xi",
      title: "FREEDOM DiVE",
      version: "FOUR DIMENSIONS",
      usage: { count: 1, lastYear: 2023 },
    },
  ]),
}));

describe("robots.txt", () => {
  it("keeps crawlers out of the API, admin and sign-in", async () => {
    const { default: robots } = await import("@/app/robots");
    expect(robots()).toEqual({
      rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/signin", "/account"] }],
      sitemap: "https://pools.haruhime.moe/sitemap.xml",
    });
  });
});

describe("sitemap.xml", () => {
  it("lists static and legal pages, current and public built pools and used maps, daily", async () => {
    const sitemap = await import("@/app/sitemap");
    expect(sitemap.revalidate).toBe(86_400);
    const urls = (await sitemap.default()).map((entry) => entry.url);
    expect(urls).toEqual([
      "https://pools.haruhime.moe/",
      "https://pools.haruhime.moe/search",
      "https://pools.haruhime.moe/check",
      "https://pools.haruhime.moe/submit",
      "https://pools.haruhime.moe/data",
      "https://pools.haruhime.moe/credits",
      "https://pools.haruhime.moe/legal/disclaimer",
      "https://pools.haruhime.moe/legal/privacy",
      "https://pools.haruhime.moe/legal/terms",
      "https://pools.haruhime.moe/pools/otdb-657",
      "https://pools.haruhime.moe/pools/b-a0000001",
      "https://pools.haruhime.moe/maps/129891",
    ]);
  });
});

describe("llms.txt", () => {
  it("serves text daily", async () => {
    const route = await import("@/app/llms.txt/route");
    expect(route.revalidate).toBe(86_400);
    const response = await route.GET();
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toContain("https://pools.haruhime.moe/pools/otdb-657");
  });
});
