/**
 * @file tests/integration/services/usage.test.ts
 * @desc Usage and stats rebuilds against the database: hidden pools never count, superseded ones
 *       keep a map shown but out of counts, a map in no pool that isn't hidden reads empty, a
 *       rebuild for some maps touches only them, a second run writes nothing, and pool stats
 *       follow their maps.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import { recomputePoolStats } from "@/services/pool-stats";
import { recomputeUsage } from "@/services/usage";
import { emptyMapUsage } from "@/utils/usage";
import { setupTestDb } from "../../helpers/db";
import { makeMap, makePool } from "../../helpers/records";

setupTestDb();

const seed = async () => {
  const maps = await mapsCollection();
  await maps.insertMany([1, 2, 3, 4].map((id) => makeMap({ _id: id, usage: emptyMapUsage() })));
  const pools = await poolsCollection();
  await pools.insertMany([
    makePool({
      _id: "otdb-1",
      name: "Alpha Cup 2020 Finals",
      slots: [
        { mod: "NM", index: 1, beatmapId: 1 },
        { mod: "HD", index: 1, beatmapId: 2 },
      ],
    }),
    makePool({
      _id: "otdb-2",
      name: "Beta Cup 2023 Finals",
      slots: [{ mod: "DT", index: 1, beatmapId: 1 }],
    }),
    makePool({
      _id: "otdb-3",
      name: "Gamma Cup 2025 Finals",
      slots: [{ mod: "NM", index: 1, beatmapId: 3 }],
      hidden: true,
    }),
    makePool({
      _id: "otdb-4",
      name: "Delta Cup 2019 Finals",
      slots: [{ mod: "HR", index: 1, beatmapId: 4 }],
      supersededBy: "otdb-2",
    }),
  ]);
  return { maps, pools };
};

describe("recomputeUsage", () => {
  it("counts current pools that aren't hidden", async () => {
    const { maps } = await seed();
    expect(await recomputeUsage()).toEqual({ maps: 4, updated: 3 });
    const usage = async (id: number) => (await maps.findOne({ _id: id }))?.usage;
    expect(await usage(1)).toEqual({
      count: 2,
      lastYear: 2023,
      playedAs: ["NM", "DT"],
      shown: true,
    });
    expect(await usage(2)).toEqual({ count: 1, lastYear: 2020, playedAs: ["HD"], shown: true });
    expect(await usage(3)).toEqual(emptyMapUsage());
    expect(await usage(4)).toEqual({ count: 0, lastYear: null, playedAs: [], shown: true });
    expect(await recomputeUsage()).toEqual({ maps: 4, updated: 0 });
  });

  it("rebuilds only the maps asked for", async () => {
    const { maps, pools } = await seed();
    await recomputeUsage();
    await pools.updateOne({ _id: "otdb-2" }, { $set: { hidden: true, visible: false } });
    expect(await recomputeUsage([1])).toEqual({ maps: 1, updated: 1 });
    expect((await maps.findOne({ _id: 1 }))?.usage).toEqual({
      count: 1,
      lastYear: 2020,
      playedAs: ["NM"],
      shown: true,
    });
    expect(await recomputeUsage([])).toEqual({ maps: 0, updated: 0 });
  });
});

describe("recomputePoolStats", () => {
  it("follows the maps and writes only what changed", async () => {
    const { maps, pools } = await seed();
    await pools.updateMany({}, { $set: { "stats.complete": false } });
    expect(await recomputePoolStats()).toBe(4);
    expect((await pools.findOne({ _id: "otdb-1" }))?.stats).toMatchObject({
      srMin: 5.5,
      count: 2,
      complete: true,
    });
    await maps.updateOne({ _id: 2 }, { $set: { stars: null } });
    expect(await recomputePoolStats(["otdb-1", "otdb-2"])).toBe(1);
    expect((await pools.findOne({ _id: "otdb-1" }))?.stats.complete).toBe(false);
    expect(await recomputePoolStats()).toBe(0);
  });
});
