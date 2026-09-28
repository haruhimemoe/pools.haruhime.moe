/**
 * @file tests/unit/utils/bucket-targets.test.ts
 * @desc Bucket targets: the /new templates (their counts and labels, only setting targets), how
 *       many maps each bucket still needs ("2 more NM maps"), whether a map's stars under its
 *       slot's mods sit outside the bucket's range, the summary's lists of both, what a target
 *       says, and the target form's text read into a target (or why not).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BucketEntry, PoolSlot } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { POOL_TEMPLATES } from "@/constants/targets";
import {
  placeholderText,
  rangeBadgeText,
  rangeSide,
  readTargetInput,
  targetGaps,
  targetsOutOfRange,
  targetText,
  templateLabel,
  templateTargets,
} from "@/utils/bucket-targets";
import { groupSlots } from "@/utils/built-editor";

const BUCKETS = ["NM", "HD", "HR", "DT", "FM", "TB"].map((code) => ({ code })) as BucketEntry[];
const slot = (mod: string, index: number, beatmapId: number): PoolSlot => ({
  mod,
  index,
  beatmapId,
});

describe("templates", () => {
  it("offers the five shapes with their counts", () => {
    expect(POOL_TEMPLATES.map((template) => templateLabel(template))).toEqual([
      "Blank",
      "Qualifiers (5 NM, 2 HD, 2 HR, 3 DT, 2 FM)",
      "Group stage (6 NM, 3 HD, 3 HR, 4 DT, 3 FM, 1 TB)",
      "Knockout (6 NM, 4 HD, 4 HR, 4 DT, 3 FM, 1 TB)",
      "Finals (7 NM, 4 HD, 4 HR, 5 DT, 4 FM, 1 TB)",
    ]);
  });

  it("turns a template into targets only (no star ranges), blank into none", () => {
    expect(templateTargets("blank")).toEqual({});
    expect(templateTargets("qualifiers")).toEqual({
      NM: { count: 5 },
      HD: { count: 2 },
      HR: { count: 2 },
      DT: { count: 3 },
      FM: { count: 2 },
    });
    expect(Object.values(templateTargets("finals")).reduce((n, t) => n + t.count, 0)).toBe(25);
  });
});

describe("gaps", () => {
  it("says how many maps each bucket still needs, in the pool's order", () => {
    const groups = groupSlots({ buckets: BUCKETS, slots: [slot("NM", 1, 1), slot("HD", 1, 2)] });
    const targets = {
      HD: { count: 1 },
      NM: { count: 3 },
      DT: { count: 0, sr: { min: 5, max: 6 } },
    };
    expect(targetGaps(groups, targets)).toEqual([{ code: "NM", have: 1, want: 3, missing: 2 }]);
    expect(placeholderText("NM", 2)).toBe("2 more NM maps");
    expect(placeholderText("HD", 1)).toBe("1 more HD map");
  });
});

describe("ranges", () => {
  const sr = { min: 5.8, max: 6.3 };

  it("says which side of the range a star rating falls, inclusive, or null", () => {
    expect(rangeSide(5.79, sr)).toBe("below");
    expect(rangeSide(5.8, sr)).toBeNull();
    expect(rangeSide(6.3, sr)).toBeNull();
    expect(rangeSide(6.31, sr)).toBe("above");
    expect(rangeSide(null, sr)).toBeNull();
    expect(rangeSide(7, undefined)).toBeNull();
  });

  it("names a badge by its side", () => {
    expect(rangeBadgeText("below", sr)).toBe("Below 5.80–6.30★");
    expect(rangeBadgeText("above", { min: 6, max: 6 })).toBe("Above 6.00★");
  });

  it("lists maps outside their bucket's range, by stars under the slot's mods", () => {
    const pool = {
      buckets: BUCKETS,
      slots: [slot("NM", 1, 1), slot("NM", 2, 2), slot("HD", 1, 3)],
    };
    const maps = { 1: { stars: 5.5 }, 2: { stars: 6 }, 3: { stars: 7 } } as never;
    const values = { "3:HD": { stars: 6.9, source: "mirror" } } as never;
    const out = targetsOutOfRange(groupSlots(pool), maps, values, {
      NM: { count: 2, sr },
      HD: { count: 0, sr: { min: 5, max: 6 } },
    });
    expect(out).toEqual([
      { beatmapId: 1, slot: "NM1", stars: 5.5, side: "below", sr },
      { beatmapId: 3, slot: "HD1", stars: 6.9, side: "above", sr: { min: 5, max: 6 } },
    ]);
  });

  it("counts a modded slot with only no-mod stars as unknown", () => {
    const pool = { buckets: BUCKETS, slots: [slot("HD", 1, 3)] };
    const maps = { 3: { stars: 9 } } as never;
    const out = targetsOutOfRange(groupSlots(pool), maps, {}, { HD: { count: 1, sr } });
    expect(out).toEqual([]);
  });
});

describe("targetText", () => {
  it("says the count and the range", () => {
    expect(targetText({ count: 5 })).toBe("5 maps");
    expect(targetText({ count: 1, sr: { min: 5.8, max: 6.3 } })).toBe("1 map, 5.80–6.30★");
    expect(targetText({ count: 0, sr: { min: 6, max: 6 } })).toBe("6.00★");
  });
});

describe("readTargetInput", () => {
  it("reads a count and an optional range", () => {
    expect(readTargetInput({ count: "5", min: "", max: "" })).toEqual({ ok: true, count: 5 });
    expect(readTargetInput({ count: " 3 ", min: "5,8", max: "6.3" })).toEqual({
      ok: true,
      count: 3,
      sr: { min: 5.8, max: 6.3 },
    });
    expect(readTargetInput({ count: "", min: "", max: "" })).toEqual({ ok: true, count: 0 });
  });

  it.each([
    [{ count: "17", min: "", max: "" }, "count", "A slot's target is 0 to 16 maps."],
    [{ count: "2.5", min: "", max: "" }, "count", "A slot's target is 0 to 16 maps."],
    [{ count: "2", min: "6", max: "" }, "range", "Give both ends of the star range, or neither."],
    [{ count: "2", min: "7", max: "6" }, "range", "The low end is above the high end."],
    [{ count: "2", min: "x", max: "6" }, "range", "Star ratings are 0 to 10."],
    [{ count: "2", min: "1", max: "11" }, "range", "Star ratings are 0 to 10."],
  ])("refuses %j (%s)", (input, field, message) => {
    expect(readTargetInput(input)).toEqual({ ok: false, field, message });
  });
});
