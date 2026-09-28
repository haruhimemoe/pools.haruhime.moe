/**
 * @file tests/unit/utils/browse-add.test.ts
 * @desc Where the map browser's Add goes and which lens a bucket opens it with. A bucket's lens:
 *       NM, HD, HR and DT as themselves, FM, TB, free and no-mod custom slots as NM, a custom
 *       slot's forced mods as their combo (NM when the mirror doesn't offer it). Add's default:
 *       the bucket "Find maps" opened the browser for while the lens still matches it, else
 *       NM, HD, HR or DT for those lenses, else the custom slot forced to exactly the lens's
 *       mods, else none (the picker asks).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { BROWSE_LENSES } from "@/constants/browse";
import { bucketLens, defaultBucketFor, lensForBucket } from "@/utils/browse-add";

const BUILT_IN = ["NM", "HD", "HR", "DT", "FM", "TB"].map((code) => ({ code })) as BucketEntry[];
const forced = (code: string, set: string[]) =>
  ({ code, color: 0, mods: { kind: "forced", set } }) as BucketEntry;
const EZ = forced("EZ", ["EZ"]);
const HDHR = forced("HDHR", ["HD", "HR"]);
const FREE = { code: "Free", color: 1, mods: { kind: "free" } } as BucketEntry;
const PLAIN = { code: "X", color: 2 } as BucketEntry;
const BUCKETS = [...BUILT_IN.slice(0, 5), EZ, HDHR, FREE, PLAIN, BUILT_IN[5]] as BucketEntry[];

describe("bucketLens", () => {
  it.each([
    [{ code: "NM" }, "NM"],
    [{ code: "HD" }, "HD"],
    [{ code: "HR" }, "HR"],
    [{ code: "DT" }, "DT"],
    [{ code: "FM" }, "NM"],
    [{ code: "TB" }, "NM"],
    [EZ, "EZ"],
    [HDHR, "HDHR"],
    [forced("Y", ["HD", "DT", "HR"]), "HDHRDT"],
    [FREE, "NM"],
    [PLAIN, "NM"],
  ] as [BucketEntry, string][])("reads %j as %s", (entry, lens) => {
    expect(bucketLens(entry)).toBe(lens);
  });
});

describe("lensForBucket", () => {
  it("opens with the bucket's lens when the mirror offers it, else NM", () => {
    expect(lensForBucket(HDHR, BROWSE_LENSES)).toBe("HDHR");
    expect(lensForBucket(HDHR, ["NM", "HD", "HR", "DT"])).toBe("NM");
    expect(lensForBucket(forced("F", ["FL"]), BROWSE_LENSES)).toBe("FL");
    expect(lensForBucket({ code: "FM" } as BucketEntry, BROWSE_LENSES)).toBe("NM");
  });
});

describe("defaultBucketFor", () => {
  it.each(["NM", "HD", "HR", "DT"] as const)("adds %s maps to the %s slot", (lens) => {
    expect(defaultBucketFor(lens, BUCKETS, null)).toBe(lens);
  });

  it("adds combos, EZ, HT and FL to the custom slot forced to exactly those mods", () => {
    expect(defaultBucketFor("EZ", BUCKETS, null)).toBe("EZ");
    expect(defaultBucketFor("HDHR", BUCKETS, null)).toBe("HDHR");
  });

  it("has no default when no slot matches, so the picker asks", () => {
    for (const lens of ["HT", "FL", "HDDT", "EZDT", "HDHRDT"] as const) {
      expect(defaultBucketFor(lens, BUCKETS, null)).toBeNull();
    }
    expect(defaultBucketFor("NM", [{ code: "HD" }] as BucketEntry[], null)).toBeNull();
  });

  it("prefers the slot Find maps opened it for while the lens still matches that slot", () => {
    expect(defaultBucketFor("NM", BUCKETS, "FM")).toBe("FM");
    expect(defaultBucketFor("NM", BUCKETS, "TB")).toBe("TB");
    expect(defaultBucketFor("NM", BUCKETS, "Free")).toBe("Free");
    expect(defaultBucketFor("HR", BUCKETS, "FM")).toBe("HR");
    expect(defaultBucketFor("NM", BUCKETS, "Gone")).toBe("NM");
  });
});
