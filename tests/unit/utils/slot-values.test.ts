/**
 * @file tests/unit/utils/slot-values.test.ts
 * @desc The pure side of values under a slot's mods: the combo each slot's values are under (NM
 *       for NM, HD, FM, TB, free and no-mod custom slots; the forced combo otherwise), for built
 *       pools and for a past pool's source slots (matched to its slots by place, else by map);
 *       a map's no-mod values; the math fallback; and what a slot says (stars with the combo, AR,
 *       OD, length, BPM, and "no mod data" when the mirror had none).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import {
  builtSlotCode,
  noModOf,
  pastSlotCodes,
  slotAnswer,
  slotValueKey,
  slotValuesText,
} from "@/utils/slot-values";

const BUCKETS = [
  { code: "NM" },
  { code: "HD" },
  { code: "HR" },
  { code: "DT" },
  { code: "FM" },
  { code: "HDHR", color: 0, mods: { kind: "forced", set: ["HD", "HR"] } },
  { code: "Free", color: 1, mods: { kind: "free" } },
  { code: "TB" },
] as BucketEntry[];

const NO_MOD = { stars: 5.5, ar: 9, od: 8, cs: 4, bpm: 180, length: 120 };

describe("the combo a slot's values are under", () => {
  it.each([
    ["NM", "NM"],
    ["HD", "NM"],
    ["HR", "HR"],
    ["DT", "DT"],
    ["FM", "NM"],
    ["TB", "NM"],
    ["HDHR", "HDHR"],
    ["Free", "NM"],
  ])("reads a %s slot as %s", (mod, code) => {
    expect(builtSlotCode({ mod, index: 1, beatmapId: 1 }, BUCKETS)).toBe(code);
  });

  it("reads a map with no slot as NM", () => {
    expect(builtSlotCode({ mod: null, index: 1, beatmapId: 1 }, BUCKETS)).toBe("NM");
  });

  it("matches a past pool's source slots to its slots by place, else by map, else NM", () => {
    const pool = {
      buckets: BUCKETS,
      slots: [
        { mod: "DT", index: 1, beatmapId: 1 },
        { mod: "HDHR", index: 1, beatmapId: 2 },
      ],
      sourceSlots: [
        { label: "DT1", beatmapId: 1, mods: ["DT"] },
        { label: "X", beatmapId: 9, mods: ["HR"] },
        { label: "HDHR1", beatmapId: 2, mods: [] },
        { label: "again", beatmapId: 1, mods: [] },
      ],
    };
    expect(pastSlotCodes(pool)).toEqual(["DT", "NM", "HDHR", "DT"]);
  });

  it("keys values by map and combo", () => {
    expect(slotValueKey(75, "HDHR")).toBe("75:HDHR");
  });
});

describe("noModOf and slotAnswer", () => {
  it("reads a map's no-mod values, null where unknown", () => {
    expect(noModOf({ stars: 5, bpm: 170, length: 90 })).toEqual({
      stars: 5,
      ar: null,
      od: null,
      cs: null,
      bpm: 170,
      length: 90,
    });
    expect(noModOf(undefined)).toEqual({
      stars: null,
      ar: null,
      od: null,
      cs: null,
      bpm: null,
      length: null,
    });
  });

  it("keeps no-mod values for NM, and computes the rest without mirror data", () => {
    expect(slotAnswer(NO_MOD, [])).toEqual({ ...NO_MOD, mods: "NM", source: "none" });
    expect(slotAnswer(NO_MOD, ["DT"])).toEqual({
      stars: 5.5,
      ar: 10.33,
      od: 9.78,
      cs: 4,
      bpm: 270,
      length: 80,
      mods: "DT",
      source: "math",
    });
    expect(slotAnswer(NO_MOD, ["HR"], { stars: 6.123, ar: 10, od: 10, cs: 5.2 })).toEqual({
      stars: 6.12,
      ar: 10,
      od: 10,
      cs: 5.2,
      bpm: 180,
      length: 120,
      mods: "HR",
      source: "mirror",
    });
  });
});

describe("slotValuesText", () => {
  it("says the stars with their combo, then AR, OD, length and BPM", () => {
    const mirror = slotAnswer(NO_MOD, ["DT"], { stars: 7.2, ar: 10.33, od: 9.78, cs: 4 });
    expect(slotValuesText(mirror)).toEqual({
      stars: "7.20★ DT",
      facts: ["AR 10.3", "OD 9.8", "1:20", "270 BPM"],
      note: null,
    });
    expect(slotValuesText(slotAnswer(NO_MOD, [])).stars).toBe("5.50★ no mod");
  });

  it("says no mod data when the mirror had none, and leaves out what isn't known", () => {
    const math = slotAnswer({ ...NO_MOD, ar: null, od: null }, ["HR"]);
    expect(slotValuesText(math)).toEqual({
      stars: "5.50★ no mod",
      facts: ["2:00", "180 BPM"],
      note: "no mod data",
    });
  });
});
