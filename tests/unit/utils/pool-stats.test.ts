/**
 * @file tests/unit/utils/pool-stats.test.ts
 * @desc Pool stats: no-mod star, length and BPM ranges over the pool's maps, count = slots (a map
 *       in two slots counts twice), and complete only when every map has all three values.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import {
  computePoolStats,
  emptyPoolStats,
  type StatsMeta,
  samePoolStats,
} from "@/utils/pool-stats";

const META = new Map<number, StatsMeta>([
  [1, { stars: 5.2, length: 120, bpm: 180 }],
  [2, { stars: 6.4, length: 95, bpm: 200 }],
  [3, { stars: null, length: 150, bpm: 170 }],
]);
const metaOf = (id: number) => META.get(id);

describe("computePoolStats", () => {
  it("gives ranges and a complete flag when every map is known", () => {
    expect(computePoolStats([{ beatmapId: 1 }, { beatmapId: 2 }], metaOf)).toEqual({
      srMin: 5.2,
      srMax: 6.4,
      lenMin: 95,
      lenMax: 120,
      bpmMin: 180,
      bpmMax: 200,
      count: 2,
      complete: true,
    });
  });

  it("counts a map in two slots twice", () => {
    expect(computePoolStats([{ beatmapId: 1 }, { beatmapId: 1 }], metaOf).count).toBe(2);
  });

  it("is incomplete when a map lacks stars or isn't known, ranges over what is", () => {
    expect(computePoolStats([{ beatmapId: 1 }, { beatmapId: 3 }], metaOf)).toMatchObject({
      srMin: 5.2,
      srMax: 5.2,
      lenMax: 150,
      complete: false,
    });
    expect(computePoolStats([{ beatmapId: 9 }], metaOf)).toEqual({ ...emptyPoolStats(1) });
  });

  it("gives nothing for an empty pool", () => {
    expect(computePoolStats([], metaOf)).toEqual(emptyPoolStats(0));
  });
});

describe("samePoolStats", () => {
  it("compares every field", () => {
    const stats = computePoolStats([{ beatmapId: 1 }], metaOf);
    expect(samePoolStats(stats, { ...stats })).toBe(true);
    expect(samePoolStats(stats, { ...stats, complete: false })).toBe(false);
  });
});
