/**
 * @file tests/integration/services/search.test.ts
 * @desc Pool and map search over the database: only visible pools and used maps; text as
 *       folded, escaped substrings (every term); every filter with its null handling and the
 *       "hidden, data missing" count; badged shown only once some pool knows it; every sort,
 *       unknowns last; paging past the end; a set link refused; no aggregation pipeline behind
 *       any search; and explain plans that prove each sort runs on its hinted index with no
 *       in-memory sort and no collection scan. Built here: public, unhidden built pools (with maps) with
 *       their owner, text and map filters, none under badged; Both lists built pools first and
 *       pages across into past pools; each built sort runs on its index.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { Collection } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { MAP_SORTS, POOL_SORTS } from "@/constants/search";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { StoredPool } from "@/schemas/pool";
import { searchMaps, searchPools } from "@/services/search";
import { builtSearchFields } from "@/utils/built-record";
import {
  EMPTY_MAP_FILTERS,
  EMPTY_POOL_FILTERS,
  type MapFilters,
  type PoolFilters,
} from "@/utils/search-params";
import { builtPoolQuery, mapQuery, poolQuery } from "@/utils/search-query";
import { makeBuiltPool } from "../../helpers/built-pools";
import { setupTestDb } from "../../helpers/db";
import { createCast } from "../../helpers/pool-requests";
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

describe("searchPools: built here", () => {
  const seedBuilt = async () => {
    const cast = await createCast();
    const built = (id: string, over: Partial<StoredBuiltPool>) => {
      const pool = makeBuiltPool({
        _id: id,
        ownerId: cast.owner.id,
        visibility: "public",
        ...over,
      });
      return { ...pool, ...builtSearchFields(pool) };
    };
    const slots = [{ mod: "NM", index: 1, beatmapId: 1 }];
    await (await builtPoolsCollection()).insertMany([
      built("b-a0000001", { name: "Café Cup Finals", year: 2026, slots }),
      built("b-a0000002", {
        name: "Zeta Cup",
        year: 2025,
        slots: [{ mod: "NM", index: 1, beatmapId: 2 }],
      }),
      built("b-a0000003", { name: "Unlisted Cup", visibility: "unlisted", slots }),
      built("b-a0000004", { name: "Private Cup", visibility: "private", slots }),
      built("b-a0000005", { name: "Hidden Cup", hidden: true, slots }),
      // Nothing to see yet: an empty pool isn't listed.
      built("b-a0000006", { name: "Empty Cup" }),
    ]);
  };
  const built = (filters: Partial<PoolFilters> = {}, page = 1) =>
    searchPools({ ...EMPTY_POOL_FILTERS, type: "built", ...filters }, page).then((answer) => {
      if ("error" in answer) throw new Error(answer.error);
      return answer;
    });

  it("lists public pools with maps that moderators haven't hidden, with their owner", async () => {
    await seedBuilt();
    await seedPools();
    const answer = await built();
    expect(answer.results.map((pool) => pool.id)).toEqual(["b-a0000001", "b-a0000002"]);
    expect(answer.results[0]).toMatchObject({
      kind: "built",
      builtBy: "owner",
      stats: { count: 1 },
    });
    expect(answer).toMatchObject({ total: 2, badgedKnown: false });
  });

  it("matches folded text, a contained map, and sorts by name", async () => {
    await seedBuilt();
    expect((await built({ q: "cafe" })).results.map((pool) => pool.id)).toEqual(["b-a0000001"]);
    expect((await built({ map: "1" })).total).toBe(1);
    expect((await built({ sort: "name" })).results[0]?.id).toBe("b-a0000001");
    expect((await built({ badged: "yes" })).total).toBe(0);
  });

  it("lists built pools first under Both, then past pools, paging across them", async () => {
    await seedBuilt();
    const pools = await poolsCollection();
    await pools.insertMany(
      Array.from({ length: 60 }, (_, i) =>
        makePool({ _id: `otdb-${100 + i}`, slots: [{ mod: "NM", index: 1, beatmapId: 1000 + i }] }),
      ),
    );
    const both = (page: number) => searchPools({ ...EMPTY_POOL_FILTERS, type: "both" }, page);
    const first = await both(1);
    if ("error" in first) throw new Error(first.error);
    expect(first.total).toBe(62);
    expect(first.results.slice(0, 3).map((pool) => pool.kind)).toEqual(["built", "built", "past"]);
    expect(first.results).toHaveLength(50);
    const second = await both(2);
    if ("error" in second) throw new Error(second.error);
    expect(second.results).toHaveLength(12);
    expect(second.results.every((pool) => pool.kind === "past")).toBe(true);
    const ids = [...first.results, ...second.results].map((pool) => pool.id);
    expect(new Set(ids).size).toBe(62);
  });

  it.each(POOL_SORTS)(
    "built pools sorted by %s run on their index, no sort stage",
    async (sort) => {
      await seedBuilt();
      const query = builtPoolQuery(
        { ...EMPTY_POOL_FILTERS, sort, q: "cup", year: [2020, null], maps: [1, 10] },
        1,
        null,
      );
      const plan = JSON.stringify(
        await (await builtPoolsCollection())
          .find(query.filter)
          .sort(query.sort)
          .hint(query.hint)
          .limit(query.limit)
          .explain("executionStats"),
      );
      expect(plan).toContain(query.hint);
      expect(plan).not.toContain('"COLLSCAN"');
      expect(plan).not.toContain('"stage":"SORT"');
    },
  );
});
