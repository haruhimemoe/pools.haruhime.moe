/**
 * @file tests/unit/utils/page-seo.test.ts
 * @desc Pool and map page SEO: "<name> mappool" titles (not doubled), the pool description, the
 *       pool's Dataset and breadcrumbs (sources as isBasedOn, year as coverage), map pages indexed
 *       only in 2 or more pools, the generated map sentence, and the map's CreativeWork with the
 *       pools it's in.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import type { HistoryRow } from "@/utils/history";
import {
  isMapIndexed,
  mapLd,
  mapSentence,
  poolDescription,
  poolLd,
  poolTitle,
} from "@/utils/page-seo";
import { makeMap, makePool, T0 } from "../../helpers/records";

const row = (overrides: Partial<HistoryRow> = {}): HistoryRow => ({
  poolId: "otdb-657",
  tournament: "osu! World Cup",
  round: "Grand Finals",
  year: 2023,
  badged: true,
  slot: "HR2",
  ...overrides,
});

describe("pool pages", () => {
  it("titles a pool '<name> mappool' once", () => {
    expect(poolTitle("osu! World Cup 2023 Grand Finals")).toBe(
      "osu! World Cup 2023 Grand Finals mappool",
    );
    expect(poolTitle("OWC 2023 Mappool")).toBe("OWC 2023 Mappool");
  });

  it("describes the pool by its headline and map count", () => {
    const pool = makePool({ name: "Spring Cup 2020 Finals" });
    expect(poolDescription(pool)).toMatch(/^Spring Cup · Finals · 2020\. 1 map with star ratings/);
  });

  it("builds a Dataset and breadcrumbs from the pool", () => {
    const graph = poolLd(makePool({ _id: "otdb-9" }));
    const [dataset, crumbs] = graph["@graph"];
    expect(dataset).toMatchObject({
      "@type": "Dataset",
      name: "Spring Cup 2020 Finals mappool",
      url: "https://pools.haruhime.moe/pools/otdb-9",
      creator: { "@type": "Organization", name: "Spring Cup" },
      temporalCoverage: "2020",
      isBasedOn: "https://otdb.sheppsu.me/db/mappools/9/",
      dateModified: T0.toISOString(),
      publisher: { "@id": "https://www.haruhime.moe/#organization" },
    });
    expect(crumbs).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, item: "https://pools.haruhime.moe/" },
        { position: 2, item: "https://pools.haruhime.moe/pools/otdb-9" },
      ],
    });
    expect(() => JSON.parse(JSON.stringify(graph))).not.toThrow();
  });
});

describe("map pages", () => {
  it("indexes a map only once 2 or more current pools use it", () => {
    expect(isMapIndexed({ count: 0 })).toBe(false);
    expect(isMapIndexed({ count: 1 })).toBe(false);
    expect(isMapIndexed({ count: 2 })).toBe(true);
  });

  it("says how often and how a map was played, and where last", () => {
    const map = makeMap({
      _id: 129891,
      artist: "xi",
      title: "FREEDOM DiVE",
      version: "FOUR DIMENSIONS",
      setHost: "Nakagawa-Kanon",
      usage: { count: 3, lastYear: 2023, playedAs: ["NM", "HR", "DT"], shown: true },
    });
    expect(mapSentence(map, [row()])).toBe(
      "xi - FREEDOM DiVE [FOUR DIMENSIONS], from Nakagawa-Kanon's set, has been played in 3 osu! tournament pools, as NM, HR and DT, most recently in osu! World Cup Grand Finals (2023).",
    );
  });

  it("words one pool, no host and no current pool", () => {
    const one = makeMap({
      _id: 5,
      setHost: null,
      usage: { count: 1, lastYear: null, playedAs: ["FM"], shown: true },
    });
    expect(mapSentence(one, [row({ round: null, year: null })])).toBe(
      "Artist - Title 5 [Insane] has been played in 1 osu! tournament pool, as FM, most recently in osu! World Cup.",
    );
    const none = makeMap({
      _id: 6,
      usage: { count: 0, lastYear: null, playedAs: [], shown: true },
    });
    expect(mapSentence(none, [])).toBe(
      "Artist - Title 6 [Insane] isn't in any current osu! tournament pool.",
    );
  });

  it("builds a CreativeWork listing each pool once, and breadcrumbs", () => {
    const map = makeMap({ _id: 7 });
    const graph = mapLd(
      map,
      [row(), row({ slot: "DT1" }), row({ poolId: "otdb-2", year: 2022 })],
      "x",
    );
    const [work, crumbs] = graph["@graph"];
    expect(work).toMatchObject({
      "@type": "CreativeWork",
      name: "Artist - Title 7 [Insane]",
      url: "https://pools.haruhime.moe/maps/7",
      author: { "@type": "Person", name: "Host" },
      isBasedOn: "https://osu.ppy.sh/beatmaps/7",
      subjectOf: {
        "@type": "ItemList",
        numberOfItems: 2,
        itemListElement: [
          { url: "https://pools.haruhime.moe/pools/otdb-657" },
          { url: "https://pools.haruhime.moe/pools/otdb-2" },
        ],
      },
    });
    expect(crumbs).toMatchObject({ "@type": "BreadcrumbList" });
  });
});
