/**
 * @file tests/integration/services/search.test.ts
 * @desc Pool and map search over the database: only visible pools and used maps; text as
 *       folded, escaped substrings (every term); every filter with its null handling and the
 *       "hidden, data missing" count; badged shown only once some pool knows it; every sort,
 *       unknowns last; paging past the end; a set link refused; no aggregation pipeline behind
 *       any search; and explain plans that prove each sort runs on its hinted index with no
 *       in-memory sort and no collection scan.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { Collection } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { MAP_SORTS, POOL_SORTS } from "@/constants/search";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import type { StoredPool } from "@/schemas/pool";
import { searchMaps, searchPools } from "@/services/search";
import {
  EMPTY_MAP_FILTERS,
  EMPTY_POOL_FILTERS,
  type MapFilters,
  type PoolFilters,
} from "@/utils/search-params";
import { mapQuery, poolQuery } from "@/utils/search-query";
import { setupTestDb } from "../../helpers/db";
import { makeMap, makePool } from "../../helpers/records";

setupTestDb();

const stats = (
  srMin: number | null,
  srMax: number | null,
  count: number,
  complete = true,
): StoredPool["stats"] => ({
  srMin,
  srMax,
  lenMin: 100,
  lenMax: 200,
  bpmMin: 150,
  bpmMax: 200,
  count,
  complete,
});

const seedPools = async () => {
  const pools = await poolsCollection();
  await pools.insertMany([
    makePool({
      _id: "otdb-1",
      name: "Alpha Cup 2023 Finals",
      stats: stats(5, 6, 10),
      badged: true,
      slots: [{ mod: "NM", index: 1, beatmapId: 1 }],
    }),
    makePool({
      _id: "otdb-2",
      name: "Beta Cup 2020 Semifinals",
      stats: stats(6.5, 7.5, 20),
      slots: [{ mod: "NM", index: 1, beatmapId: 2 }],
    }),
    makePool({
      _id: "otdb-3",
      name: "Gamma Tourney Finals",
      stats: stats(4, 5, 12),
      slots: [{ mod: "NM", index: 1, beatmapId: 3 }],
    }),
    makePool({
      _id: "otdb-4",
      name: "Delta Cup 2019 Finals",
      stats: stats(null, null, 8, false),
      slots: [{ mod: "NM", index: 1, beatmapId: 4 }],
    }),
    makePool({
      _id: "otdb-5",
      name: "Hidden Cup 2021 Finals",
      hidden: true,
      slots: [{ mod: "NM", index: 1, beatmapId: 5 }],
    }),
    makePool({
      _id: "otdb-6",
      name: "Old Cup 2018 Finals",
      supersededBy: "otdb-1",
      slots: [{ mod: "NM", index: 1, beatmapId: 6 }],
    }),
    makePool({
      _id: "otdb-7",
      name: "Café Cup 2021 Quarterfinals",
      stats: stats(5.5, 6, 16),
      slots: [{ mod: "NM", index: 1, beatmapId: 777 }],
    }),
  ]);
  return pools;
};

const pools = async (filters: Partial<PoolFilters>, page = 1) => {
  const answer = await searchPools({ ...EMPTY_POOL_FILTERS, ...filters }, page);
  if ("error" in answer) throw new Error(answer.error);
  return answer;
};

const ids = (answer: { results: { id: string | number }[] }) =>
  answer.results.map((result) => result.id);

describe("searchPools", () => {
  it("lists visible pools newest first, unknown years last", async () => {
    await seedPools();
    const answer = await pools({});
    expect(ids(answer)).toEqual(["otdb-1", "otdb-7", "otdb-2", "otdb-4", "otdb-3"]);
    expect(answer).toMatchObject({
      page: 1,
      pageCount: 1,
      total: 5,
      hiddenMissing: 0,
      badgedKnown: true,
    });
  });

  it("matches folded, escaped text, every term", async () => {
    await seedPools();
    expect(ids(await pools({ q: "cafe" }))).toEqual(["otdb-7"]);
    expect(ids(await pools({ q: "CUP finals" }))).toEqual(["otdb-1", "otdb-7", "otdb-2", "otdb-4"]);
    expect(ids(await pools({ q: "(20k [EZ] C++ .*" }))).toEqual([]);
  });

  it("finds full-width letters and regex characters as plain text", async () => {
    await (await poolsCollection()).insertMany([
      makePool({
        _id: "otdb-8",
        name: "ＯＷＣ 2023 Finals (20k-10k)",
        slots: [{ mod: "NM", index: 1, beatmapId: 8 }],
      }),
      makePool({
        _id: "otdb-9",
        name: "C++ Cup [EZ] 2022 Finals",
        slots: [{ mod: "NM", index: 1, beatmapId: 9 }],
      }),
    ]);
    expect(ids(await pools({ q: "owc" }))).toEqual(["otdb-8"]);
    expect(ids(await pools({ q: "ＯＷＣ" }))).toEqual(["otdb-8"]);
    expect(ids(await pools({ q: "(20k-10k)" }))).toEqual(["otdb-8"]);
    expect(ids(await pools({ q: "c++ [ez]" }))).toEqual(["otdb-9"]);
  });

  it("filters by year, leaving out and counting pools with no year", async () => {
    await seedPools();
    const answer = await pools({ year: [2020, null] });
    expect(ids(answer)).toEqual(["otdb-1", "otdb-7", "otdb-2"]);
    expect(answer.hiddenMissing).toBe(1);
  });

  it("overlaps stars over complete stats, counting incomplete pools", async () => {
    await seedPools();
    const answer = await pools({ sr: [5.8, 6.2] });
    expect(ids(answer)).toEqual(["otdb-1", "otdb-7"]);
    expect(answer.hiddenMissing).toBe(1);
  });

  it("filters by badged, map count and a contained map", async () => {
    await seedPools();
    expect(ids(await pools({ badged: "yes" }))).toEqual(["otdb-1"]);
    expect(ids(await pools({ badged: "unknown" }))).toEqual([
      "otdb-7",
      "otdb-2",
      "otdb-4",
      "otdb-3",
    ]);
    expect(ids(await pools({ maps: [15, null] }))).toEqual(["otdb-7", "otdb-2"]);
    expect(ids(await pools({ map: "https://osu.ppy.sh/b/777" }))).toEqual(["otdb-7"]);
    expect(
      await searchPools({ ...EMPTY_POOL_FILTERS, map: "https://osu.ppy.sh/beatmapsets/39804" }, 1),
    ).toEqual({
      error: expect.stringMatching(/set/i),
    });
  });

  it("hides the badged filter until some pool knows it", async () => {
    const collection = await seedPools();
    await collection.updateOne({ _id: "otdb-1" }, { $set: { badged: null } });
    expect((await pools({})).badgedKnown).toBe(false);
  });

  it("sorts by name and by most maps", async () => {
    await seedPools();
    expect(ids(await pools({ sort: "name" }))).toEqual([
      "otdb-1",
      "otdb-2",
      "otdb-7",
      "otdb-4",
      "otdb-3",
    ]);
    expect(ids(await pools({ sort: "maps" }))).toEqual([
      "otdb-2",
      "otdb-7",
      "otdb-3",
      "otdb-1",
      "otdb-4",
    ]);
  });

  it("pages 50 at a time and answers an empty page past the end", async () => {
    const collection = await poolsCollection();
    await collection.insertMany(
      Array.from({ length: 60 }, (_, i) =>
        makePool({
          _id: `otdb-${100 + i}`,
          name: `Cup ${100 + i} Finals`,
          slots: [{ mod: "NM", index: 1, beatmapId: 1000 + i }],
        }),
      ),
    );
    expect((await pools({}, 2)).results).toHaveLength(10);
    const past = await pools({}, 200);
    expect(past).toMatchObject({ page: 200, pageCount: 2, total: 60, results: [] });
  });
});

const seedMaps = async () => {
  const maps = await mapsCollection();
  await maps.insertMany([
    makeMap({
      _id: 1,
      title: "Zeta",
      stars: 6.5,
      length: 200,
      usage: { count: 3, lastYear: 2023, playedAs: ["NM", "HD"], shown: true },
    }),
    makeMap({
      _id: 2,
      title: "alpha",
      stars: null,
      length: 100,
      usage: { count: 1, lastYear: null, playedAs: ["DT"], shown: true },
    }),
    makeMap({
      _id: 3,
      title: "Éclair",
      stars: 4.2,
      length: null,
      usage: { count: 5, lastYear: 2020, playedAs: ["NM", "DT", "EZ"], shown: true },
    }),
    makeMap({
      _id: 4,
      title: "Unused",
      usage: { count: 0, lastYear: null, playedAs: [], shown: true },
    }),
    makeMap({
      _id: 5,
      title: null,
      stars: 7.1,
      length: 150,
      usage: { count: 2, lastYear: 2021, playedAs: ["HR"], shown: true },
    }),
  ]);
};

const maps = async (filters: Partial<MapFilters>) =>
  searchMaps({ ...EMPTY_MAP_FILTERS, ...filters }, 1);

describe("searchMaps", () => {
  it.each<[MapFilters["sort"], number[]]>([
    ["used", [3, 1, 5, 2]],
    ["last", [1, 5, 3, 2]],
    ["stars", [5, 1, 3, 2]],
    ["length", [1, 5, 2, 3]],
    ["title", [2, 3, 1, 5]],
  ])("sorts by %s, unknowns last, used maps only", async (sort, expected) => {
    await seedMaps();
    expect(ids(await maps({ sort }))).toEqual(expected);
  });

  it("needs every ticked played-as code", async () => {
    await seedMaps();
    expect(ids(await maps({ played: ["NM", "DT"] }))).toEqual([3]);
    expect(ids(await maps({ played: ["NM"] }))).toEqual([3, 1]);
  });

  it("filters ranges, counting maps without the value", async () => {
    await seedMaps();
    const starry = await maps({ sr: [6, null] });
    expect(ids(starry)).toEqual([1, 5]);
    expect(starry.hiddenMissing).toBe(1);
    const recent = await maps({ last: [2021, null] });
    expect(ids(recent)).toEqual([1, 5]);
    expect(recent.hiddenMissing).toBe(1);
    expect(ids(await maps({ used: [3, null] }))).toEqual([3, 1]);
    expect(ids(await maps({ q: "eclair" }))).toEqual([3]);
  });

  it("filters by length, leaving out and counting the map with no length", async () => {
    await seedMaps();
    const answer = await maps({ len: [90, 180] });
    expect(ids(answer)).toEqual([5, 2]);
    expect(answer.hiddenMissing).toBe(1);
  });
});

describe("no aggregation", () => {
  it("counts pools and maps, missing data included, without an aggregation pipeline", async () => {
    await seedPools();
    await seedMaps();
    const aggregate = vi.spyOn(Collection.prototype, "aggregate");
    try {
      expect((await pools({ year: [2020, null], sr: [5.8, 6.2] })).total).toBeGreaterThan(0);
      expect((await maps({ sr: [6, null], len: [90, 180] })).hiddenMissing).toBeGreaterThan(0);
      expect(aggregate).not.toHaveBeenCalled();
    } finally {
      aggregate.mockRestore();
    }
  });
});

describe("explain", () => {
  /** The whole explain answer as text: which stages and index it used. */
  const planText = (explain: unknown): string => JSON.stringify(explain);

  it.each(POOL_SORTS)("pools sorted by %s run on their index with no sort stage", async (sort) => {
    const collection = await seedPools();
    const query = poolQuery(
      { ...EMPTY_POOL_FILTERS, sort, q: "cup", year: [2015, null], badged: "unknown" },
      1,
      null,
    );
    const plan = planText(
      await collection
        .find(query.filter)
        .sort(query.sort)
        .hint(query.hint)
        .skip(query.skip)
        .limit(query.limit)
        .explain("executionStats"),
    );
    expect(plan).toContain(query.hint);
    expect(plan).not.toContain('"COLLSCAN"');
    expect(plan).not.toContain('"stage":"SORT"');
  });

  it.each(MAP_SORTS)("maps sorted by %s run on their index with no sort stage", async (sort) => {
    await seedMaps();
    const collection = await mapsCollection();
    const query = mapQuery(
      { ...EMPTY_MAP_FILTERS, sort, q: "a", played: ["NM"], sr: [4, null] },
      1,
    );
    const plan = planText(
      await collection
        .find(query.filter)
        .sort(query.sort)
        .hint(query.hint)
        .skip(query.skip)
        .limit(query.limit)
        .explain("executionStats"),
    );
    expect(plan).toContain(query.hint);
    expect(plan).not.toContain('"COLLSCAN"');
    expect(plan).not.toContain('"stage":"SORT"');
  });
});
