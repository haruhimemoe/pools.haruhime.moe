/**
 * @file tests/unit/utils/map-card.test.ts
 * @desc pools' records onto the kit's MapCard: BuiltMap to MapData, and a slot's facts under its
 *       mods (stars with what they're under, AR/OD/CS/length/BPM, "no mod data") or, before the
 *       values are known, the no-mod stars, length and BPM.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { describe, expect, it } from "vitest";
import type { BuiltMap } from "@/schemas/built-pool-view";
import { slotFacts, toMapData } from "@/utils/map-card";

const MAP: BuiltMap = {
  id: 129891,
  setId: 39804,
  artist: "xi",
  title: "FREEDOM DiVE",
  version: "FOUR DIMENSIONS",
  setHost: "Nakagawa-Kanon",
  stars: 7.1,
  length: 263,
  bpm: 222,
  ar: 9,
  od: 8,
  cs: 4,
  usage: { count: 3, lastYear: 2025 },
};

describe("map-card", () => {
  it("maps a BuiltMap onto MapData", () => {
    expect(toMapData(MAP)).toEqual({
      beatmapsetId: 39804,
      artist: "xi",
      title: "FREEDOM DiVE",
      version: "FOUR DIMENSIONS",
      creator: "Nakagawa-Kanon",
      starRating: 7.1,
      cs: 4,
      ar: 9,
      od: 8,
      bpm: 222,
      lengthSeconds: 263,
    });
    expect(toMapData(null)).toBeNull();
    expect(toMapData(undefined)).toBeNull();
  });

  it("shows no-mod stars, length and BPM before the slot's values are known", () => {
    expect(slotFacts(undefined, MAP)).toEqual({
      stars: 7.1,
      starsNote: "no mod",
      stats: { cs: null, ar: null, od: null, hp: null, bpm: 222, lengthSeconds: 263 },
      note: null,
    });
  });

  it("shows values under the mods from the mirror, and says when there was no mod data", () => {
    const values = {
      stars: 8.2,
      ar: 10,
      od: 9.5,
      cs: 4,
      bpm: 333,
      length: 175,
      mods: "DT",
      source: "mirror" as const,
    };
    expect(slotFacts(values, MAP)).toEqual({
      stars: 8.2,
      starsNote: "DT",
      stats: { cs: 4, ar: 10, od: 9.5, hp: null, bpm: 333, lengthSeconds: 175 },
      note: null,
    });
    expect(slotFacts({ ...values, source: "math" }, MAP)).toMatchObject({
      starsNote: "no mod",
      note: "no mod data",
    });
  });
});
