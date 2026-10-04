/**
 * @file tests/unit/app/pages.test.ts
 * @desc Public pages are cookie-free ISR: the home, pool and map pages regenerate hourly with no
 *       build-time params, no public page reads cookies or headers (/data and /submit included),
 *       a hidden or unknown pool 404s, a pool page reads each slot's values under its mods at
 *       render (the mod_values cache, never cookies), and a map id that isn't a whole number 404s
 *       without a lookup.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { makePool } from "../../helpers/records";

const {
  getPublicPool,
  getMapSummaries,
  loadHomeCounts,
  getPublicMap,
  getMapHistory,
  pastSlotValues,
} = vi.hoisted(() => ({
  getPublicPool: vi.fn(),
  getMapSummaries: vi.fn(),
  loadHomeCounts: vi.fn(),
  getPublicMap: vi.fn(),
  getMapHistory: vi.fn(),
  pastSlotValues: vi.fn(),
}));
vi.mock("@/services/pools", () => ({ getPublicPool, getMapSummaries, loadHomeCounts }));
vi.mock("@/services/slot-values", () => ({ pastSlotValues }));
vi.mock("@/services/maps", () => ({ getPublicMap, getMapHistory }));

const PUBLIC_PAGES = [
  "src/app/page.tsx",
  "src/app/pools/[id]/page.tsx",
  "src/app/maps/[id]/page.tsx",
  "src/app/credits/page.tsx",
  "src/app/data/page.tsx",
  "src/app/submit/page.tsx",
  "src/app/legal/[slug]/page.tsx",
  "src/app/docs/[slug]/page.tsx",
  "src/app/brand/page.tsx",
  "src/app/search/page.tsx",
  "src/app/check/page.tsx",
];

const notFoundDigest = async (promise: Promise<unknown>): Promise<string | undefined> => {
  try {
    await promise;
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
  return undefined;
};

describe("public pages", () => {
  it.each([
    ["/", () => import("@/app/page")],
    ["/pools/[id]", () => import("@/app/pools/[id]/page")],
    ["/maps/[id]", () => import("@/app/maps/[id]/page")],
  ])("%s regenerates at most hourly", async (_route, load) => {
    expect((await load()).revalidate).toBe(3600);
  });

  it("builds no pool or map pages ahead of time", async () => {
    expect((await import("@/app/pools/[id]/page")).generateStaticParams()).toEqual([]);
    expect((await import("@/app/maps/[id]/page")).generateStaticParams()).toEqual([]);
  });

  it.each(PUBLIC_PAGES)("%s reads no cookies or headers", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/next\/headers|cookies\(|getCurrentUser/);
  });

  it("404s a hidden or unknown pool", async () => {
    getPublicPool.mockResolvedValue(null);
    const { default: PoolPage } = await import("@/app/pools/[id]/page");
    expect(
      await notFoundDigest(PoolPage({ params: Promise.resolve({ id: "otdb-1" }) } as never)),
    ).toMatch(/404/);
  });

  it("shows each slot's values under its mods, read at render", async () => {
    const pool = makePool({ slots: [{ mod: "DT", index: 1, beatmapId: 5 }] });
    getPublicPool.mockResolvedValue(pool);
    const maps = new Map([[5, { _id: 5, stars: 5, length: 120, bpm: 180, ar: 9, od: 8, cs: 4 }]]);
    getMapSummaries.mockResolvedValue(maps);
    const dt = { stars: 7.2, ar: 10.33, od: 9.78, cs: 4, bpm: 270, length: 80 };
    pastSlotValues.mockResolvedValue({
      values: [{ ...dt, mods: "DT", source: "mirror" }],
      complete: true,
    });
    const { default: PoolPage } = await import("@/app/pools/[id]/page");
    const html = renderToStaticMarkup(
      await PoolPage({ params: Promise.resolve({ id: "otdb-1" }) } as never),
    );
    expect(pastSlotValues).toHaveBeenCalledWith(pool, maps);
    expect(html).toContain("7.20 stars");
    expect(html).toContain(">DT<");
  });

  it("404s a map id that isn't a whole number, without a lookup", async () => {
    getPublicMap.mockClear();
    const { default: MapPage } = await import("@/app/maps/[id]/page");
    expect(
      await notFoundDigest(MapPage({ params: Promise.resolve({ id: "12abc" }) } as never)),
    ).toMatch(/404/);
    expect(getPublicMap).not.toHaveBeenCalled();
  });
});
