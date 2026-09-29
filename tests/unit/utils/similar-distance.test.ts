/**
 * @file tests/unit/utils/similar-distance.test.ts
 * @desc The "difficulty match" fallback: the weighted distance (zero for the same values, each
 *       value's weight and scale, unknown AR, OD or CS adding nothing), the closeness percent,
 *       and the ranking (closest first, ties by id, never the map, its set or a repeat, at most
 *       the count asked).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { FALLBACK_WEIGHTS } from "@/constants/similar";
import {
  closenessPercent,
  type DifficultyPoint,
  difficultyDistance,
  nearestByDifficulty,
} from "@/utils/similar-distance";

const POINT: DifficultyPoint = { stars: 6, bpm: 200, length: 120, ar: 9.5, od: 9, cs: 4 };

describe("difficultyDistance", () => {
  it("is zero for the same values", () => {
    expect(difficultyDistance(POINT, POINT)).toBe(0);
  });

  it("weighs each value over its scale", () => {
    const { weight, scale } = FALLBACK_WEIGHTS.stars;
    const moved = { ...POINT, stars: POINT.stars + scale };
    expect(difficultyDistance(POINT, moved)).toBeCloseTo(Math.sqrt(weight));
    const bpm = { ...POINT, bpm: POINT.bpm + FALLBACK_WEIGHTS.bpm.scale * 2 };
    expect(difficultyDistance(POINT, bpm)).toBeCloseTo(Math.sqrt(FALLBACK_WEIGHTS.bpm.weight * 4));
  });

  it("leaves out AR, OD and CS unknown on either side", () => {
    const unknown = { ...POINT, ar: null, od: null, cs: 7 };
    const far = { ...POINT, ar: 1, od: 1, cs: null };
    expect(difficultyDistance(unknown, far)).toBe(0);
  });

  it("is symmetric", () => {
    const other = { ...POINT, stars: 6.4, bpm: 180, length: 90, ar: 10 };
    expect(difficultyDistance(POINT, other)).toBeCloseTo(difficultyDistance(other, POINT));
  });
});

describe("closenessPercent", () => {
  it("is 100 at no distance and falls as it grows", () => {
    expect(closenessPercent(0)).toBe(100);
    expect(closenessPercent(4)).toBe(50);
    expect(closenessPercent(1)).toBeGreaterThan(closenessPercent(2));
  });
});

describe("nearestByDifficulty", () => {
  const source = { id: 1, setId: 10, point: POINT };
  const at = (id: number, setId: number, change: Partial<DifficultyPoint>) => ({
    id,
    setId,
    point: { ...POINT, ...change },
  });

  it("ranks closest first, never the map, its set or a repeat", () => {
    const ranked = nearestByDifficulty(
      source,
      [
        at(1, 10, {}),
        at(2, 10, {}),
        at(5, 50, { stars: 7 }),
        at(4, 40, { stars: 6.1 }),
        at(3, 30, { stars: 6.1 }),
        at(4, 40, { stars: 6 }),
      ],
      10,
    );
    expect(ranked.map((entry) => entry.id)).toEqual([3, 4, 5]);
    expect(ranked[0]?.percent).toBeGreaterThan(ranked[2]?.percent ?? 100);
  });

  it("keeps at most the count asked", () => {
    const many = Array.from({ length: 30 }, (_, i) => at(100 + i, 200 + i, { bpm: 200 + i }));
    expect(nearestByDifficulty(source, many, 20)).toHaveLength(20);
    expect(nearestByDifficulty({ ...source, setId: null }, [], 20)).toEqual([]);
  });
});
