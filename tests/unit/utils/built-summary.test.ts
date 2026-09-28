/**
 * @file tests/unit/utils/built-summary.test.ts
 * @desc A built pool's summary: star ranges per bucket that has maps (with how many stars are
 *       known), sets in more than one slot, and maps past pools played.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import type { BuiltMap } from "@/schemas/built-pool-view";
import { groupSlots } from "@/utils/built-editor";
import { playedBefore, repeatedSets, starRanges } from "@/utils/built-summary";

const map = (id: number, over: Partial<BuiltMap> = {}): BuiltMap => ({
  id,
  setId: id * 10,
  artist: "xi",
  title: `Song ${id}`,
  version: "Hard",
  setHost: "Nakagawa-Kanon",
  stars: null,
  length: null,
  bpm: null,
  ar: null,
  od: null,
  cs: null,
  usage: { count: 0, lastYear: null },
  ...over,
});

const slots: PoolSlot[] = [
  { mod: "NM", index: 1, beatmapId: 1 },
  { mod: "NM", index: 2, beatmapId: 2 },
  { mod: "HD", index: 1, beatmapId: 3 },
  { mod: "HR", index: 1, beatmapId: 4 },
];
const buckets = ["NM", "HD", "HR", "DT", "FM", "TB"].map((code) => ({ code })) as BucketEntry[];
const maps = {
  1: map(1, { stars: 5.2, usage: { count: 3, lastYear: 2024 } }),
  2: map(2, { stars: 4.81 }),
  3: map(3, { setId: 10 }),
  4: null,
};

describe("built pool summary", () => {
  it("uses each slot's stars under its mods when they're known", () => {
    const values = {
      "1:NM": { stars: 5.2, mods: "NM", source: "none" },
      "4:HR": { stars: 6.4, mods: "HR", source: "mirror" },
      "2:HR": { stars: 9.9, mods: "HR", source: "mirror" },
    } as never;
    expect(starRanges(groupSlots({ buckets, slots }), maps, values)).toEqual([
      { title: "NM", low: 4.81, high: 5.2, maps: 2, known: 2 },
      { title: "HD", low: null, high: null, maps: 1, known: 0 },
      { title: "HR", low: 6.4, high: 6.4, maps: 1, known: 1 },
    ]);
  });

  it("gives each bucket with maps its star range", () => {
    expect(starRanges(groupSlots({ buckets, slots }), maps)).toEqual([
      { title: "NM", low: 4.81, high: 5.2, maps: 2, known: 2 },
      { title: "HD", low: null, high: null, maps: 1, known: 0 },
      { title: "HR", low: null, high: null, maps: 1, known: 0 },
    ]);
  });

  it("finds a set in two slots", () => {
    expect(repeatedSets(slots, maps)).toEqual([
      { setId: 10, name: "xi - Song 1", slots: ["NM1", "HD1"] },
    ]);
    expect(repeatedSets(slots, { 1: map(1), 3: map(3) })).toEqual([]);
  });

  it("lists maps past pools played", () => {
    expect(playedBefore(slots, maps)).toEqual([
      { beatmapId: 1, slot: "NM1", label: "xi - Song 1 [Hard]", count: 3, lastYear: 2024 },
    ]);
  });
});
