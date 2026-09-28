/**
 * @file tests/unit/schemas/built-candidates.test.ts
 * @desc Candidates as stored: slot keys name a bucket the pool has ("NM:2", any script's letters),
 *       at most 10 per slot and 100 per pool, no map twice in a slot, never the slot's own pick,
 *       no empty list, notes through the content filter; a pool stored before candidates (no
 *       field) reads as having none, and reads check shape only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { candidateKey, placeOfKey } from "@/schemas/built-candidates";
import { builtPoolReadSchema, storedBuiltPoolSchema } from "@/schemas/built-pool";
import { makeBuiltPool } from "../../helpers/built-pools";
import { candidate } from "../../helpers/candidates";

const SLOTS = [{ mod: "NM", index: 1, beatmapId: 10 }];
const parse = (candidates: unknown) =>
  storedBuiltPoolSchema.safeParse({ ...makeBuiltPool({ slots: SLOTS }), candidates });
const problem = (candidates: unknown) => {
  const result = parse(candidates);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("slot keys", () => {
  it("round-trips a slot and refuses keys of the wrong shape", () => {
    expect(placeOfKey(candidateKey({ bucket: "NM", index: 2 }))).toEqual({
      bucket: "NM",
      index: 2,
    });
    expect(placeOfKey("段位:3")).toEqual({ bucket: "段位", index: 3 });
    for (const key of ["NM", ":1", "NM:0", "NM:100", "N M:1", "NM:x"]) {
      expect(placeOfKey(key)).toBeNull();
    }
  });
});

describe("stored candidates", () => {
  it("takes a pool with none, with the field left out, and with some", () => {
    expect(storedBuiltPoolSchema.safeParse(makeBuiltPool()).success).toBe(true);
    expect(problem({ "NM:1": [candidate(11)], "HD:3": [candidate(12)] })).toBeNull();
  });

  it("refuses what the ops never write", () => {
    expect(problem({ "EZ:1": [candidate(11)] })).toMatch(/slot that isn't here/);
    expect(problem({ "NM:1": [] })).toMatch(/empty/);
    expect(problem({ "NM:1": [candidate(11), candidate(11)] })).toMatch(/twice/);
    expect(problem({ "NM:1": [candidate(10)] })).toMatch(/pick and its candidate/);
    const eleven = Array.from({ length: 11 }, (_, i) => candidate(100 + i));
    expect(problem({ "NM:2": eleven })).toMatch(/too many candidates/);
    const many = Object.fromEntries(
      Array.from({ length: 11 }, (_, s) => [
        `NM:${s + 2}`,
        Array.from({ length: 10 }, (_, i) => candidate(1000 + s * 10 + i)),
      ]),
    );
    expect(problem(many)).toMatch(/pool has too many/);
    expect(parse({ "NM:2": [candidate(11, { note: "sieg heil" })] }).success).toBe(false);
  });

  it("reads a stored pool by shape, whatever its candidates' notes say", () => {
    const row = {
      ...makeBuiltPool(),
      candidates: { "NM:2": [candidate(11, { note: "sieg heil" })] },
    };
    expect(builtPoolReadSchema.safeParse(row).success).toBe(true);
  });
});
