/**
 * @file tests/unit/app/seo.test.ts
 * @desc robots.txt keeps every crawler, AI ones included, out of /api (its OpenAPI document aside), /admin, /signin and
 *       /account; the sitemap lists the static pages (/submit and /data among them), the legal
 *       pages (with their last update), current pools and public built pools (their updatedAt)
 *       and maps in 2 or more pools (asked for as such), with no made-up lastmod; llms.txt is a
 *       short daily text route linking /llms-full.txt, which lists every pool and the maps.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Oct 3, 2026
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
const listListedMaps = vi.hoisted(() => vi.fn());
vi.mock("@/services/maps", () => ({ listListedMaps }));
listListedMaps.mockImplementation(async () => [
  {
    _id: 129891,
    artist: "xi",
    title: "FREEDOM DiVE",
    version: "FOUR DIMENSIONS",
    usage: { count: 2, lastYear: 2023 },
  },
]);

describe("robots.txt", () => {
  it("keeps every crawler, AI ones by name, out of the API, admin and sign-in", async () => {
    const { default: robots } = await import("@/app/robots");
    const { rules, sitemap, host } = robots();
    const groups = Array.isArray(rules) ? rules : [rules];
    expect(groups[0]).toEqual({
      userAgent: "*",
      allow: ["/", "/api/v1/openapi.json"],
      disallow: ["/api/", "/admin", "/signin", "/account"],
    });
    const named = groups.slice(1).flatMap((group) => [group.userAgent].flat());
    expect(named).toEqual(expect.arrayContaining(["GPTBot", "ClaudeBot", "PerplexityBot"]));
    for (const group of groups) expect(group.disallow).not.toContain("/");
    expect(sitemap).toBe("https://pools.haruhime.moe/sitemap.xml");
    expect(host).toBe("https://pools.haruhime.moe");
  });
});

describe("sitemap.xml", () => {
  it("lists static and legal pages, current and public built pools and maps in 2+ pools", async () => {
    const sitemap = await import("@/app/sitemap");
    expect(sitemap.revalidate).toBe(86_400);
    const entries = await sitemap.default();
    expect(listListedMaps).toHaveBeenCalledWith(undefined, 2);
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://pools.haruhime.moe/",
      "https://pools.haruhime.moe/search",
      "https://pools.haruhime.moe/check",
      "https://pools.haruhime.moe/submit",
      "https://pools.haruhime.moe/data",
      "https://pools.haruhime.moe/credits",
      "https://pools.haruhime.moe/docs/api",
      "https://pools.haruhime.moe/legal/disclaimer",
      "https://pools.haruhime.moe/legal/privacy",
      "https://pools.haruhime.moe/legal/terms",
      "https://pools.haruhime.moe/pools/otdb-657",
      "https://pools.haruhime.moe/pools/b-a0000001",
      "https://pools.haruhime.moe/maps/129891",
    ]);
  });

  it("gives lastmod only where there's a real date", async () => {
    const { LEGAL_DOCS } = await import("@/constants/legal");
    const entries = await (await import("@/app/sitemap")).default();
    const lastmod = Object.fromEntries(entries.map((entry) => [entry.url, entry.lastModified]));
    expect(lastmod["https://pools.haruhime.moe/"]).toBeUndefined();
    expect(lastmod["https://pools.haruhime.moe/maps/129891"]).toBeUndefined();
    expect(lastmod["https://pools.haruhime.moe/pools/otdb-657"]).toBe(DATE.toISOString());
    expect(lastmod["https://pools.haruhime.moe/legal/terms"]).toBe(
      new Date(LEGAL_DOCS.terms.lastUpdated).toISOString(),
    );
  });
});

describe("llms.txt", () => {
  it("serves a short index daily, linking the full lists", async () => {
    const route = await import("@/app/llms.txt/route");
    expect(route.revalidate).toBe(86_400);
    const response = await route.GET();
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const text = await response.text();
    expect(text).toContain("https://pools.haruhime.moe/pools/otdb-657");
    expect(text).toContain("https://pools.haruhime.moe/pools/b-a0000001");
    expect(text).toContain("(https://pools.haruhime.moe/llms-full.txt)");
    expect(text).not.toContain("/maps/");
  });

  it("serves the full lists at /llms-full.txt, daily", async () => {
    const route = await import("@/app/llms-full.txt/route");
    expect(route.revalidate).toBe(86_400);
    const response = await route.GET();
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const text = await response.text();
    expect(text).toContain("https://pools.haruhime.moe/pools/otdb-657");
    expect(text).toContain("https://pools.haruhime.moe/maps/129891");
    expect(listListedMaps).toHaveBeenCalledWith(500);
  });
});
