/**
 * @file tests/unit/utils/browse-values.test.ts
 * @desc A browse row's values under the lens: BPM and length from the no-mod values and the mod
 *       math (rounded), AR, OD and CS from the mirror when it has them (source "mirror"), else
 *       from no-mod values and the math (source "math", "no mod data"), else unknown; and the
 *       page filters (BPM, length, AR, OD under the lens, open at the sliders' edges, unknown
 *       values failing a set filter).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import { AR_RANGE } from "@/constants/search";
import { DEFAULT_BROWSE_PARAMS } from "@/utils/browse-params";
import { diffValues, inRange, passesPageFilters } from "@/utils/browse-values";

const ROW = { bpm: 181, length: 116 };
const BASE = { ar: 9, od: 8, cs: 4 };
const MIRROR = { stars: 7.1, ar: 10.333, od: 9.777, cs: 4, bpm: 271.5 };

describe("diffValues", () => {
  it("takes AR, OD and CS from the mirror and BPM and length from the math", () => {
    expect(diffValues(ROW, ["DT"], MIRROR, BASE)).toEqual({
      ar: 10.33,
      od: 9.78,
      cs: 4,
      bpm: 271.5,
      length: 77,
      source: "mirror",
    });
  });

  it("computes AR, OD and CS from no-mod values when the mirror has none", () => {
    expect(diffValues(ROW, ["HR", "DT"], undefined, BASE)).toEqual({
      ar: 11,
      od: 11.11,
      cs: 5.2,
      bpm: 271.5,
      length: 77,
      source: "math",
    });
  });

  it("answers unknown AR, OD and CS when nothing has them", () => {
    expect(diffValues(ROW, ["HT"], undefined, null)).toEqual({
      ar: null,
      od: null,
      cs: null,
      bpm: 135.75,
      length: 155,
      source: "math",
    });
  });

  it("leaves no-mod values alone", () => {
    expect(diffValues(ROW, [], undefined, BASE)).toMatchObject({ ...BASE, ...ROW });
  });
});

describe("inRange", () => {
  it("passes anything with no range", () => {
    expect(inRange(null, null, AR_RANGE)).toBe(true);
  });

  it("reads a bottom end at the slider's minimum as no lower limit", () => {
    expect(inRange(-2.33, [0, 8], AR_RANGE)).toBe(true);
    expect(inRange(8.01, [0, 8], AR_RANGE)).toBe(false);
    expect(inRange(11.2, [9, null], AR_RANGE)).toBe(true);
    expect(inRange(8.9, [9, null], AR_RANGE)).toBe(false);
  });

  it("fails an unknown value against a range", () => {
    expect(inRange(null, [9, 10], AR_RANGE)).toBe(false);
  });
});

describe("passesPageFilters", () => {
  const values = { ar: 10.33, od: 9.78, cs: 4, bpm: 271.5, length: 77 };

  it("passes everything with no filters", () => {
    expect(passesPageFilters(values, DEFAULT_BROWSE_PARAMS)).toBe(true);
  });

  it.each([
    [{ bpm: [270, 280] }, true],
    [{ bpm: [180, 240] }, false],
    [{ len: [60, 90] }, true],
    [{ len: [90, null] }, false],
    [{ ar: [10, 10.5] }, true],
    [{ ar: [9, 10] }, false],
    [{ od: [9.5, null] }, true],
    [{ od: [0, 9] }, false],
  ] as const)("checks %j", (filters, expected) => {
    expect(passesPageFilters(values, { ...DEFAULT_BROWSE_PARAMS, ...filters })).toBe(expected);
  });
});
