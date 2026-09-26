/**
 * @file tests/integration/services/public.test.ts
 * @desc What public pages read: a hidden pool is never returned (a superseded one is), bad ids
 *       read as missing, home counts see only current pools and used maps (counted with the
 *       count command, never an aggregation), the sitemap and llms.txt lists leave hidden and
 *       superseded pools and unused maps out, a map whose pools are all hidden is missing while
 *       one whose pools are all superseded stays, and history lists only current pools, newest
 *       first, one row per slot. The home page's Recently added lists the 8 visible pools added
 *       last on their own index. The home, sitemap and llms.txt reads let a database error
 *       through at runtime (so ISR keeps the last good version) and come back empty only under
 *       SKIP_ENV_VALIDATION.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

import { Collection } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { MAP_INDEXES, POOL_INDEXES, QUERY_TIME_MS } from "@/constants/db";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import { countMatching } from "@/services/count";
import { getMapHistory, getPublicMap, listListedMaps } from "@/services/maps";
import {
  getMapSummaries,
  getPoolById,
  getPublicPool,
  listCurrentPools,
  listRecentPools,
  loadHomeCounts,
} from "@/services/pools";
import { recomputeUsage } from "@/services/usage";
import { setupTestDb } from "../../helpers/db";
import { makeMap, makePool } from "../../helpers/records";

setupTestDb();

const seed = async () => {
  const pools = await poolsCollection();
  const maps = await mapsCollection();
  await maps.insertMany([1, 2, 3, 4].map((id) => makeMap({ _id: id })));
  await pools.insertMany([
    makePool({
      _id: "otdb-1",
      name: "Alpha Cup 2020 Finals",
      slots: [
        { mod: "NM", index: 1, beatmapId: 1 },
        { mod: "NM", index: 2, beatmapId: 1 },
      ],
    }),
    makePool({
      _id: "otdb-2",
      name: "Beta Cup Semifinals",
      slots: [{ mod: "HD", index: 1, beatmapId: 1 }],
      badged: true,
    }),
    makePool({
      _id: "otdb-3",
      name: "Gamma Cup 2025 Finals",
      slots: [{ mod: "NM", index: 1, beatmapId: 2 }],
      hidden: true,
    }),
    makePool({
      _id: "otdb-4",
      name: "Delta Cup 2019 Finals",
      slots: [{ mod: "HR", index: 1, beatmapId: 3 }],
      supersededBy: "otdb-2",
    }),
  ]);
  await recomputeUsage();
  return { pools, maps };
};

describe("pools", () => {
  it("never returns a hidden pool publicly, keeps a superseded one, and refuses bad ids", async () => {
    await seed();
    expect(await getPublicPool("otdb-3")).toBeNull();
    expect(await getPoolById("otdb-3")).toMatchObject({ hidden: true });
    expect(await getPublicPool("otdb-4")).toMatchObject({ supersededBy: "otdb-2" });
    expect(await getPublicPool("OTDB-1")).toBeNull();
    expect(await getPublicPool("../x")).toBeNull();
    expect(await getPublicPool("otdb-9")).toBeNull();
  });

  it("reads the maps a pool page shows", async () => {
    await seed();
    const maps = await getMapSummaries([1, 1, 9]);
    expect([...maps.keys()]).toEqual([1]);
    expect(maps.get(1)).toMatchObject({ title: "Title 1", stars: 5.5 });
  });

  it("counts current pools, used maps and sources for the home page, with no aggregation", async () => {
    await seed();
    const aggregate = vi.spyOn(Collection.prototype, "aggregate");
    try {
      expect(await loadHomeCounts()).toEqual({ pools: 2, maps: 1, sources: ["otdb"] });
      expect(aggregate).not.toHaveBeenCalled();
    } finally {
      aggregate.mockRestore();
    }
  });

  it("counts with the count command on the hinted index", async () => {
    const { pools, maps } = await seed();
    const options = { hint: POOL_INDEXES.year, maxTimeMS: QUERY_TIME_MS };
    expect(await countMatching(pools, { visible: true }, options)).toBe(2);
    expect(await countMatching(pools, { visible: true, _id: "otdb-9" }, options)).toBe(0);
    expect(
      await countMatching(
        maps,
        { "usage.count": { $gte: 1 } },
        { hint: MAP_INDEXES.used, maxTimeMS: QUERY_TIME_MS },
      ),
    ).toBe(1);
  });

  it("lists current pools, newest first", async () => {
    await seed();
    expect((await listCurrentPools()).map((pool) => pool._id)).toEqual(["otdb-1", "otdb-2"]);
  });

  it("lists the 8 visible pools added last, newest first, on their own index", async () => {
    const pools = await poolsCollection();
    await pools.insertMany(
      Array.from({ length: 10 }, (_, i) =>
        makePool({
          _id: `otdb-${10 + i}`,
          slots: [{ mod: "NM", index: 1, beatmapId: 100 + i }],
          createdAt: new Date(Date.UTC(2026, 8, 1 + i)),
          hidden: i === 9,
        }),
      ),
    );
    const recent = await listRecentPools();
    expect(recent.map((pool) => pool._id)).toEqual([
      "otdb-18",
      "otdb-17",
      "otdb-16",
      "otdb-15",
      "otdb-14",
      "otdb-13",
      "otdb-12",
      "otdb-11",
    ]);
    expect(recent[0]).toMatchObject({ name: "Spring Cup 2020 Finals", year: 2020 });
    const plan = (await pools
      .find({ visible: true }, { sort: { createdAt: -1, _id: 1 }, limit: 8 })
      .hint(POOL_INDEXES.recent)
      .explain()) as { queryPlanner: { winningPlan: unknown } };
    expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain(POOL_INDEXES.recent);
  });
});

describe("maps", () => {
  it("hides a map whose pools are all hidden and keeps one whose pools are all superseded", async () => {
    await seed();
    expect(await getPublicMap(2)).toBeNull();
    expect(await getPublicMap(3)).toMatchObject({ usage: { count: 0, shown: true } });
    expect(await getPublicMap(4)).toBeNull();
    expect(await getPublicMap(0)).toBeNull();
    expect(await getPublicMap(1.5)).toBeNull();
  });

  it("lists history from current pools only, newest first, a slot per row", async () => {
    await seed();
    expect(await getMapHistory(1)).toEqual([
      {
        poolId: "otdb-1",
        tournament: "Alpha Cup",
        round: "Finals",
        year: 2020,
        badged: null,
        slot: "NM1",
      },
      {
        poolId: "otdb-1",
        tournament: "Alpha Cup",
        round: "Finals",
        year: 2020,
        badged: null,
        slot: "NM2",
      },
      {
        poolId: "otdb-2",
        tournament: "Beta Cup",
        round: "Semifinals",
        year: null,
        badged: true,
        slot: "HD1",
      },
    ]);
    expect(await getMapHistory(3)).toEqual([]);
  });

  it("lists used maps only, most used first, up to a limit", async () => {
    await seed();
    expect((await listListedMaps()).map((map) => map._id)).toEqual([1]);
    expect(await listListedMaps(0)).toEqual([]);
  });
});

describe("home, sitemap and llms.txt reads", () => {
  it("let a database error through at runtime, so ISR keeps the last good version", async () => {
    await seed();
    const fail = () => {
      throw new Error("server selection timed out");
    };
    vi.spyOn(Collection.prototype, "find").mockImplementation(fail);
    vi.spyOn(Collection.prototype, "distinct").mockImplementation(fail);
    try {
      await expect(loadHomeCounts()).rejects.toThrow("server selection timed out");
      await expect(listCurrentPools()).rejects.toThrow("server selection timed out");
      await expect(listRecentPools()).rejects.toThrow("server selection timed out");
      await expect(listListedMaps()).rejects.toThrow("server selection timed out");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("come back empty under SKIP_ENV_VALIDATION (the CI build), without the database", async () => {
    await seed();
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    const find = vi.spyOn(Collection.prototype, "find");
    try {
      expect(await loadHomeCounts()).toEqual({ pools: 0, maps: 0, sources: [] });
      expect(await listCurrentPools()).toEqual([]);
      expect(await listRecentPools()).toEqual([]);
      expect(await listListedMaps()).toEqual([]);
      expect(find).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      vi.stubEnv("SKIP_ENV_VALIDATION", "");
    }
  });
});
