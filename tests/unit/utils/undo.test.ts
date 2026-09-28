/**
 * @file tests/unit/utils/undo.test.ts
 * @desc Undo's inverses: for every op (details, add, remove with its note, move, slot mods, add
 *       and remove bucket with its target, paste, target, note) the inverse ops put the pool
 *       back exactly as it was; a change whose inverse wouldn't (or wouldn't fit one call) has
 *       none. The history keeps the last 20 steps and drops the ones never saved.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltContent } from "@/utils/built-content";
import { applyOps } from "@/utils/built-ops";
import { confirmSteps, dropUnsaved, inverseOf, pushStep, sameContent } from "@/utils/undo";

const BUILT_IN = ["NM", "HD", "HR", "DT", "FM", "TB"].map((code) => ({ code })) as BucketEntry[];
const EZ = { code: "EZ", color: 3, mods: { kind: "forced", set: ["EZ"] } } as BucketEntry;

const BASE: BuiltContent = {
  name: "Cup",
  tournament: "Spring",
  round: "Finals",
  year: 2026,
  notes: "",
  buckets: [...BUILT_IN.slice(0, 5), EZ, BUILT_IN[5] as BucketEntry],
  slots: [
    { mod: "NM", index: 1, beatmapId: 10 },
    { mod: "NM", index: 2, beatmapId: 20 },
    { mod: "HD", index: 1, beatmapId: 30 },
    { mod: "EZ", index: 1, beatmapId: 40 },
  ],
  targets: { NM: { count: 5 }, EZ: { count: 1, sr: { min: 4, max: 5 } } },
  slotNotes: { 20: "jump aim" },
};

const apply = (pool: BuiltContent, ops: readonly PoolOp[]) => {
  const result = applyOps(pool, ops);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.pool;
};

const roundTrip = (ops: PoolOp[], pool: BuiltContent = BASE) => {
  const inverse = inverseOf(pool, ops);
  if (!inverse) throw new Error("no inverse");
  return sameContent(apply(apply(pool, ops), inverse), apply(pool, []));
};

describe("inverseOf", () => {
  it.each<[string, PoolOp[]]>([
    ["details", [{ type: "setDetails", name: "Semis", year: null }]],
    ["an added map", [{ type: "addMap", beatmapId: 50, bucket: "NM", index: 1 }]],
    ["a removed map and its note", [{ type: "removeMap", slot: { bucket: "NM", index: 2 } }]],
    ["a move", [{ type: "moveMap", slot: { bucket: "NM", index: 1 }, bucket: "HD", index: 1 }]],
    ["slot mods", [{ type: "setSlotMods", bucket: "EZ", mods: { kind: "free" } }]],
    ["an added bucket", [{ type: "addBucket", code: "Speed" }]],
    ["a target", [{ type: "setTarget", bucket: "HD", count: 3 }]],
    ["a cleared target", [{ type: "setTarget", bucket: "NM", count: 0 }]],
    ["a note", [{ type: "setNote", beatmapId: 10, note: "tb backup" }]],
    ["a paste", [{ type: "replaceMaps", text: "NM1 99\nX1 98" }]],
    [
      "several ops",
      [
        { type: "addMap", beatmapId: 50, bucket: "DT" },
        { type: "setNote", beatmapId: 50, note: "fast" },
        { type: "moveMap", slot: { bucket: "DT", index: 1 }, bucket: "NM" },
      ],
    ],
  ])("puts back %s", (_, ops) => {
    expect(roundTrip(ops)).toBe(true);
  });

  it("puts back a removed empty bucket with its target when its place is the same", () => {
    const pool = { ...BASE, slots: BASE.slots.filter((slot) => slot.mod !== "EZ") };
    expect(roundTrip([{ type: "removeBucket", code: "EZ" }], pool)).toBe(true);
  });

  it("has none when the inverse wouldn't put the pool back", () => {
    const two = { code: "Two", color: 4 } as BucketEntry;
    const buckets = [...BUILT_IN.slice(0, 5), EZ, two, BUILT_IN[5] as BucketEntry];
    const pool = { ...BASE, buckets, slots: BASE.slots.slice(0, 3) };
    expect(inverseOf(pool, [{ type: "removeBucket", code: "EZ" }])).toBeNull();
    expect(inverseOf(BASE, [{ type: "addMap", beatmapId: 10, bucket: "NM" }])).toBeNull();
  });
});

describe("the history", () => {
  const step = (id: number) => ({ id, ops: [] as PoolOp[], saved: false });

  it("keeps the last 20 steps", () => {
    let history = Array.from({ length: 20 }, (_, i) => step(i));
    history = pushStep(history, step(20));
    expect(history).toHaveLength(20);
    expect(history[0]?.id).toBe(1);
  });

  it("drops steps never saved, and keeps saved ones", () => {
    const history = confirmSteps([step(1), step(2), step(3)], [1, 2]);
    expect(dropUnsaved(history).map((entry) => entry.id)).toEqual([1, 2]);
  });
});
