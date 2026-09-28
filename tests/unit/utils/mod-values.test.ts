/**
 * @file tests/unit/utils/mod-values.test.ts
 * @desc Values under mods with known answers: mod combos read with @haruhimemoe/pool's codes (NC
 *       as DT, any order, conflicts refused); BPM and length under DT and HT; AR, OD and CS
 *       under HR (capped at 10) and EZ; the DT and HT timing conversion through osu!'s preempt
 *       and 300 hit window formulas (AR9 DT 10.33, OD8 DT 9.78, both sides of AR5); and
 *       combos composing (HR or EZ first, then the timing); which mods a pool slot's values use.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import {
  arToPreempt,
  arUnderMods,
  bpmUnderMods,
  clockRate,
  csUnderMods,
  hitWindowToOd,
  lengthUnderMods,
  modsCode,
  odToHitWindow,
  odUnderMods,
  parseMods,
  preemptToAr,
  valueModsOf,
  valuesUnderMods,
} from "@/utils/mod-values";

describe("parseMods", () => {
  it.each([
    ["NM", []],
    ["", []],
    ["nm", []],
    ["HD", ["HD"]],
    ["hdhr", ["HD", "HR"]],
    ["DTHD", ["HD", "DT"]],
    ["NC", ["DT"]],
    ["HDNC", ["HD", "DT"]],
    ["HDHRDT", ["HD", "HR", "DT"]],
    ["EZHT", ["EZ", "HT"]],
    ["HDHRDTFL", ["HD", "HR", "DT", "FL"]],
  ])("reads %j", (text, mods) => {
    expect(parseMods(text)).toEqual(mods);
  });

  it.each(["XX", "HDH", "HDHD", "NCDT", "EZHR", "DTHT", "NMHD", "SD", "H D"])(
    "refuses %j",
    (text) => {
      expect(parseMods(text)).toBeNull();
    },
  );
});

describe("modsCode", () => {
  it("names no mods NM and a combo in canonical order", () => {
    expect(modsCode([])).toBe("NM");
    expect(modsCode(["HD", "HR", "DT"])).toBe("HDHRDT");
  });
});

describe("clockRate", () => {
  it("is 1.5 with DT, 0.75 with HT and 1 otherwise", () => {
    expect(clockRate(["HD", "DT"])).toBe(1.5);
    expect(clockRate(["EZ", "HT"])).toBe(0.75);
    expect(clockRate(["HR", "FL"])).toBe(1);
  });
});

describe("the timing formulas", () => {
  it.each([
    [0, 1800],
    [5, 1200],
    [9, 600],
    [10, 450],
    [11, 300],
  ])("gives AR%d a preempt of %d ms, and back", (ar, ms) => {
    expect(arToPreempt(ar)).toBeCloseTo(ms, 9);
    expect(preemptToAr(ms)).toBeCloseTo(ar, 9);
  });

  it.each([
    [0, 80],
    [8, 32],
    [10, 20],
  ])("gives OD%d a 300 window of %d ms, and back", (od, ms) => {
    expect(odToHitWindow(od)).toBeCloseTo(ms, 9);
    expect(hitWindowToOd(ms)).toBeCloseTo(od, 9);
  });
});

describe("arUnderMods", () => {
  it.each([
    [9, [], 9],
    [9, ["HD", "FL"], 9],
    [9, ["DT"], 10.3333],
    [10, ["DT"], 11],
    [4, ["DT"], 7.1333],
    [9, ["HT"], 7.6667],
    [2, ["HT"], -2.3333],
    [9, ["HR"], 10],
    [7, ["HR"], 9.8],
    [9, ["EZ"], 4.5],
    [9, ["HR", "DT"], 11],
    [9, ["HD", "HR", "DT"], 11],
    [9, ["EZ", "DT"], 7.4],
    [9, ["EZ", "HT"], 1],
  ] as const)("AR%d with %j is about %d", (ar, mods, expected) => {
    expect(arUnderMods(ar, mods)).toBeCloseTo(expected, 3);
  });
});

describe("odUnderMods", () => {
  it.each([
    [8, [], 8],
    [8, ["DT"], 9.7778],
    [10, ["DT"], 11.1111],
    [8, ["HT"], 6.2222],
    [8, ["HR"], 10],
    [6, ["HR"], 8.4],
    [8, ["EZ"], 4],
    [8, ["HR", "DT"], 11.1111],
    [8, ["EZ", "HT"], 0.8889],
  ] as const)("OD%d with %j is about %d", (od, mods, expected) => {
    expect(odUnderMods(od, mods)).toBeCloseTo(expected, 3);
  });
});

describe("csUnderMods", () => {
  it.each([
    [4, [], 4],
    [4, ["HR"], 5.2],
    [8, ["HR"], 10],
    [4, ["EZ"], 2],
    [4, ["DT"], 4],
    [4, ["HT"], 4],
    [4, ["HR", "DT"], 5.2],
  ] as const)("CS%d with %j is %d", (cs, mods, expected) => {
    expect(csUnderMods(cs, mods)).toBeCloseTo(expected, 9);
  });
});

describe("bpmUnderMods and lengthUnderMods", () => {
  it("speeds up with DT and slows down with HT", () => {
    expect(bpmUnderMods(180, ["DT"])).toBe(270);
    expect(bpmUnderMods(180, ["HD", "DT"])).toBe(270);
    expect(bpmUnderMods(180, ["HT"])).toBe(135);
    expect(bpmUnderMods(180, ["HR"])).toBe(180);
    expect(lengthUnderMods(120, ["DT"])).toBe(80);
    expect(lengthUnderMods(120, ["HT"])).toBe(160);
    expect(lengthUnderMods(120, [])).toBe(120);
  });
});

describe("valuesUnderMods", () => {
  it("composes a combo: HR first, then the DT timing", () => {
    const values = valuesUnderMods({ ar: 9, od: 8, cs: 4, bpm: 180, length: 120 }, [
      "HD",
      "HR",
      "DT",
    ]);
    expect(values.ar).toBeCloseTo(11, 9);
    expect(values.od).toBeCloseTo(11.1111, 3);
    expect(values.cs).toBeCloseTo(5.2, 9);
    expect(values).toMatchObject({ bpm: 270, length: 80 });
  });

  it("leaves no-mod values alone", () => {
    const base = { ar: 9.3, od: 8.5, cs: 4.2, bpm: 200, length: 95 };
    expect(valuesUnderMods(base, [])).toEqual(base);
  });
});

describe("valueModsOf", () => {
  it.each([
    ["NM", []],
    ["HD", ["HD"]],
    ["FM", []],
    ["TB", []],
    ["HR", ["HR"]],
    ["DT", ["DT"]],
    ["FL", ["FL"]],
    ["HDHR", ["HD", "HR"]],
    ["EZHT", ["EZ", "HT"]],
  ])("reads a %s slot as %j", (code, mods) => {
    expect(valueModsOf(code)).toEqual(mods);
  });
});
