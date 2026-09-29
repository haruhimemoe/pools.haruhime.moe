/**
 * @file tests/unit/app/page-seo.test.ts
 * @desc What pages tell search engines: the home page's keyword title, canonical and JSON-LD
 *       graph (Organization, WebSite with its SearchAction, WebApplication, the FAQ it shows);
 *       every static page's own title, canonical and og:url with the link preview kept; /search's
 *       server HTML (heading, intro, common starts, latest pools); pool pages as "<name> mappool"
 *       with a Dataset; map pages noindex under 2 pools; missing pools and maps, and the 404 page,
 *       titled "not found".
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makeMap, makePool } from "../../helpers/records";

const { getPublicPool, getPublicMap, getMapHistory } = vi.hoisted(() => ({
  getPublicPool: vi.fn(),
  getPublicMap: vi.fn(),
  getMapHistory: vi.fn(async () => []),
}));
vi.mock("@/services/pools", () => ({
  getPublicPool,
  getMapSummaries: vi.fn(async () => new Map()),
  loadHomeCounts: vi.fn(async () => ({ pools: 633, maps: 7093 })),
  listRecentPools: vi.fn(async () => [makePool({ _id: "otdb-657", name: "OWC 2023 Finals" })]),
}));
vi.mock("@/services/built-listings", () => ({ listPublicBuiltPools: vi.fn(async () => []) }));
vi.mock("@/services/maps", () => ({ getPublicMap, getMapHistory }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/services/slot-values", () => ({
  pastSlotValues: vi.fn(async () => ({ values: [], complete: true })),
}));

const ldOf = (html: string): { "@graph": { "@type": string }[] } => {
  const json = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1];
  return JSON.parse(json ?? "null");
};

const props = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

describe("home page", () => {
  it("has the keyword title, canonical / and the site's JSON-LD graph", async () => {
    const home = await import("@/app/page");
    expect(home.metadata.title).toEqual({
      absolute: "osu! tournament mappool builder · pools.haruhime.moe",
    });
    expect(home.metadata.alternates?.canonical).toBe("https://pools.haruhime.moe/");
    const html = renderToStaticMarkup(await home.default());
    const types = ldOf(html)["@graph"].map((node) => node["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "WebApplication", "FAQPage"]);
    expect(html).toContain("https://pools.haruhime.moe/search?q={search_term_string}");
    expect(html).toContain("Is pools free?");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
});

describe("static pages", () => {
  it.each([
    ["/search", () => import("@/app/search/page")],
    ["/check", () => import("@/app/check/page")],
    ["/submit", () => import("@/app/submit/page")],
    ["/data", () => import("@/app/data/page")],
    ["/credits", () => import("@/app/credits/page")],
  ])("%s has its own canonical, og:url and link preview", async (path, load) => {
    const { metadata } = await load();
    const url = `https://pools.haruhime.moe${path}`;
    expect(metadata.alternates?.canonical).toBe(url);
    expect(metadata.openGraph).toMatchObject({ url, siteName: "pools" });
    expect(JSON.stringify(metadata.openGraph)).toContain("/opengraph-image.png");
  });

  it("renders /search's default state on the server", async () => {
    const search = await import("@/app/search/page");
    expect(search.revalidate).toBe(3600);
    const html = renderToStaticMarkup(await search.default());
    expect(html).toContain("Search osu! tournament mappools and maps");
    expect(html).toContain("Common searches");
    expect(html).toContain('href="/search?tab=maps&amp;scope=played&amp;used=10-"');
    expect(html).toContain('href="/pools/otdb-657"');
  });
});

describe("pool and map pages", () => {
  it("titles a pool '<name> mappool' and sends its Dataset", async () => {
    getPublicPool.mockResolvedValue(makePool({ _id: "otdb-9", name: "OWC 2023 Finals" }));
    const page = await import("@/app/pools/[id]/page");
    const metadata = await page.generateMetadata(props("otdb-9"));
    expect(metadata.title).toEqual({ absolute: "OWC 2023 Finals mappool · pools.haruhime.moe" });
    expect(metadata.robots).toBeUndefined();
    const html = renderToStaticMarkup(await page.default(props("otdb-9")));
    expect(ldOf(html)["@graph"].map((node) => node["@type"])).toEqual([
      "Dataset",
      "BreadcrumbList",
    ]);
  });

  it("keeps a superseded pool out of the index, and titles a missing one", async () => {
    const page = await import("@/app/pools/[id]/page");
    getPublicPool.mockResolvedValue(makePool({ _id: "otdb-8", supersededBy: "otdb-9" }));
    expect((await page.generateMetadata(props("otdb-8"))).robots).toEqual({
      index: false,
      follow: true,
    });
    getPublicPool.mockResolvedValue(null);
    expect((await page.generateMetadata(props("otdb-7"))).title).toEqual({
      absolute: "Pool not found · pools.haruhime.moe",
    });
  });

  it("indexes a map page from 2 pools on, with its sentence and a named cover", async () => {
    const page = await import("@/app/maps/[id]/page");
    const usage = (count: number) => ({
      count,
      lastYear: 2023,
      playedAs: ["HR" as const],
      shown: true,
    });
    getPublicMap.mockResolvedValue(makeMap({ _id: 11, setId: 3, usage: usage(1) }));
    const thin = await page.generateMetadata(props("11"));
    expect(thin.robots).toEqual({ index: false, follow: true });
    expect(thin.description).toMatch(/has been played in 1 osu! tournament pool, as HR/);
    getPublicMap.mockResolvedValue(makeMap({ _id: 12, setId: 3, usage: usage(2) }));
    expect((await page.generateMetadata(props("12"))).robots).toBeUndefined();
    const html = renderToStaticMarkup(await page.default(props("12")));
    expect(html).toContain('alt="Artist - Title 12 cover"');
    expect(html).toContain("has been played in 2 osu! tournament pools");
    expect(ldOf(html)["@graph"][0]?.["@type"]).toBe("CreativeWork");
    getPublicMap.mockResolvedValue(null);
    expect((await page.generateMetadata(props("13"))).title).toEqual({
      absolute: "Map not found · pools.haruhime.moe",
    });
  });
});

describe("404 page", () => {
  it("is titled Page not found and kept out of the index", async () => {
    const { metadata } = await import("@/app/not-found");
    expect(metadata.title).toEqual({ absolute: "Page not found · pools.haruhime.moe" });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
