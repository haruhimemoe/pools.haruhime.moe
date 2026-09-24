/**
 * @file tests/unit/utils/usage.test.ts
 * @desc Map usage from the pools that aren't hidden: count (distinct current pools, a map twice
 *       in one pool once), lastYear (unknown years skipped), playedAs (built-in codes, a custom
 *       slot's forced mods, FM for a free custom slot, NM for a plain custom slot or no slot, in
 *       chip order), shown (superseded pools count for it, not for count), and the summary line.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import {
  buildUsage,
  emptyMapUsage,
  playedAsOf,
  sameUsage,
  type UsagePool,
  usageSummary,
} from "@/utils/usage";

const EZ_BUCKETS: BucketEntry[] = [
  { code: "NM" },
  { code: "HD" },
  { code: "HR" },
  { code: "DT" },
  { code: "FM" },
  { code: "EZHD", color: 0, mods: { kind: "forced", set: ["EZ", "HD"] } },
  { code: "X", color: 1, mods: { kind: "free" } },
  { code: "S", color: 2 },
  { code: "TB" },
];

describe("playedAsOf", () => {
  it("reads built-in codes and custom slots' mods", () => {
    expect(playedAsOf({ mod: "DT", index: 1, beatmapId: 1 }, undefined)).toEqual(["DT"]);
    expect(
      playedAsOf({ mod: "EZHD", index: 1, beatmapId: 1 }, { kind: "forced", set: ["EZ", "HD"] }),
    ).toEqual(["EZ", "HD"]);
    expect(playedAsOf({ mod: "X", index: 1, beatmapId: 1 }, { kind: "free" })).toEqual(["FM"]);
    expect(playedAsOf({ mod: "S", index: 1, beatmapId: 1 }, { kind: "none" })).toEqual(["NM"]);
    expect(playedAsOf({ mod: null, index: 3, beatmapId: 1 }, undefined)).toEqual(["NM"]);
  });
});

describe("buildUsage", () => {
  const pools: UsagePool[] = [
    {
      id: "otdb-1",
      year: 2020,
      current: true,
      slots: [
        { mod: "NM", index: 1, beatmapId: 1 },
        { mod: "HD", index: 1, beatmapId: 2 },
      ],
    },
    {
      id: "otdb-2",
      year: 2023,
      current: true,
      slots: [
        { mod: "EZHD", index: 1, beatmapId: 1 },
        { mod: null, index: 1, beatmapId: 3 },
      ],
      buckets: EZ_BUCKETS,
    },
    {
      id: "otdb-3",
      year: null,
      current: true,
      slots: [
        { mod: "FM", index: 1, beatmapId: 1 },
        { mod: "NM", index: 2, beatmapId: 1 },
      ],
    },
    {
      id: "otdb-4",
      year: 2025,
      current: false,
      slots: [
        { mod: "HR", index: 1, beatmapId: 1 },
        { mod: "HR", index: 2, beatmapId: 4 },
      ],
    },
  ];
  const usage = buildUsage(pools);

  it("counts distinct current pools, a map twice in one pool once", () => {
    expect(usage.get(1)).toEqual({
      count: 3,
      lastYear: 2023,
      playedAs: ["NM", "HD", "FM", "EZ"],
      shown: true,
    });
  });

  it("reads a map without a slot as NM", () => {
    expect(usage.get(3)).toEqual({ count: 1, lastYear: 2023, playedAs: ["NM"], shown: true });
  });

  it("keeps a map only a superseded pool has shown, with no uses", () => {
    expect(usage.get(4)).toEqual({ count: 0, lastYear: null, playedAs: [], shown: true });
  });

  it("leaves out maps no pool has", () => {
    expect(usage.has(5)).toBe(false);
  });
});

describe("sameUsage", () => {
  it("compares every field, playedAs in order", () => {
    const a = { count: 1, lastYear: 2020, playedAs: ["NM" as const], shown: true };
    expect(sameUsage(a, { ...a, playedAs: ["NM"] })).toBe(true);
    expect(sameUsage(a, { ...a, lastYear: null })).toBe(false);
    expect(sameUsage(a, { ...a, playedAs: ["HD"] })).toBe(false);
    expect(sameUsage(emptyMapUsage(), emptyMapUsage())).toBe(true);
  });
});

describe("usageSummary", () => {
  it.each([
    [{ count: 3, lastYear: 2023 }, "Used in 3 pools (latest 2023)"],
    [{ count: 1, lastYear: null }, "Used in 1 pool"],
    [{ count: 0, lastYear: null }, "Not in any current pool"],
  ])("says %j", (usage, text) => {
    expect(usageSummary(usage)).toBe(text);
  });
});
