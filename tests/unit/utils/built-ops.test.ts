/**
 * @file tests/unit/utils/built-ops.test.ts
 * @desc Applying a call's ops to a built pool, in order, all or nothing: details; adding a map
 *       (at the end or at a slot number, never one already in the pool, never a 65th, never into
 *       a bucket the pool lacks or a full one); removing and moving maps (the gaps close);
 *       custom buckets (add with the next free color and optional mods, set mods, remove an
 *       empty one; never a ninth, a clashing code or a built-in); and pasting a pool over the
 *       maps or merged into them (packs' parser, new codes becoming custom buckets, bad lines
 *       refused with their line numbers). A failure names the op it stopped at.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { describe, expect, it } from "vitest";
import type { PoolOp } from "@/schemas/built-pool-ops";
import { applyOps, type BuiltContent } from "@/utils/built-ops";

const EMPTY: BuiltContent = {
  name: "Cup",
  tournament: "",
  round: "",
  year: null,
  notes: "",
  slots: [],
};

const run = (ops: PoolOp[], pool: BuiltContent = EMPTY) => applyOps(pool, ops);

const slotsOf = (ops: PoolOp[], pool?: BuiltContent) => {
  const result = run(ops, pool);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.pool.slots.map((s) => `${s.mod ?? "-"}${s.index}:${s.beatmapId}`);
};

const failure = (ops: PoolOp[], pool?: BuiltContent) => {
  const result = run(ops, pool);
  if (result.ok) throw new Error("expected a failure");
  return result;
};

const add = (beatmapId: number, bucket: string | null = "NM", index?: number): PoolOp =>
  index === undefined
    ? { type: "addMap", beatmapId, bucket }
    : { type: "addMap", beatmapId, bucket, index };

describe("setDetails", () => {
  it("changes only the details it's given", () => {
    const result = run([{ type: "setDetails", name: "Finals", year: 2024 }]);
    expect(result.ok && result.pool).toMatchObject({ name: "Finals", year: 2024, round: "" });
  });
});

describe("addMap", () => {
  it("adds at the end of a bucket, or at a slot number, shifting later ones up", () => {
    expect(slotsOf([add(1), add(2), add(3, "NM", 1), add(4, "HD"), add(5, null)])).toEqual([
      "-1:5",
      "NM1:3",
      "NM2:1",
      "NM3:2",
      "HD1:4",
    ]);
    expect(slotsOf([add(1), add(2, "NM", 9)])).toEqual(["NM1:1", "NM2:2"]);
  });

  it("refuses a map already in the pool, a 65th map, and a bucket the pool lacks", () => {
    expect(failure([add(1), add(1, "HD")])).toMatchObject({ code: "duplicate", op: 1 });
    const full: BuiltContent = {
      ...EMPTY,
      slots: Array.from({ length: 64 }, (_, i) => ({ mod: null, index: i + 1, beatmapId: i + 1 })),
    };
    expect(failure([add(999)], full)).toMatchObject({ code: "too_many_maps", op: 0 });
    expect(failure([add(1, "EZ")])).toMatchObject({ code: "unknown_bucket" });
  });
});

describe("removeMap and moveMap", () => {
  const three = [add(1), add(2), add(3), add(4, "HD")];

  it("removes a map and closes the gap", () => {
    expect(slotsOf([...three, { type: "removeMap", slot: { bucket: "NM", index: 1 } }])).toEqual([
      "NM1:2",
      "NM2:3",
      "HD1:4",
    ]);
    expect(failure([{ type: "removeMap", slot: { bucket: "NM", index: 1 } }])).toMatchObject({
      code: "unknown_slot",
    });
  });

  it("moves a map to another bucket or another number in its own", () => {
    const move = (bucket: string | null, index?: number): PoolOp => ({
      type: "moveMap",
      slot: { bucket: "NM", index: 1 },
      bucket,
      ...(index === undefined ? {} : { index }),
    });
    expect(slotsOf([...three, move("HD", 1)])).toEqual(["NM1:2", "NM2:3", "HD1:1", "HD2:4"]);
    expect(slotsOf([...three, move("HD")])).toEqual(["NM1:2", "NM2:3", "HD1:4", "HD2:1"]);
    expect(slotsOf([...three, move("NM", 3)])).toEqual(["NM1:2", "NM2:3", "NM3:1", "HD1:4"]);
    expect(slotsOf([...three, move(null)])).toEqual(["-1:1", "NM1:2", "NM2:3", "HD1:4"]);
    expect(failure([...three, move("EZ")])).toMatchObject({ code: "unknown_bucket", op: 4 });
  });
});

describe("custom buckets", () => {
  const bucketsOf = (ops: PoolOp[]) => {
    const result = run(ops);
    if (!result.ok) throw new Error(result.code);
    return result.pool.buckets;
  };

  it("adds one before TB with the next free color, and sets its mods", () => {
    expect(
      bucketsOf([
        { type: "addBucket", code: "EZ", mods: { kind: "forced", set: ["EZ"] } },
        { type: "addBucket", code: "Speed", color: 5 },
        { type: "setSlotMods", bucket: "Speed", mods: { kind: "free" } },
      ]),
    ).toEqual([
      { code: "NM" },
      { code: "HD" },
      { code: "HR" },
      { code: "DT" },
      { code: "FM" },
      { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
      { code: "Speed", color: 5, mods: { kind: "free" } },
      { code: "TB" },
    ]);
  });

  it("removes an empty custom bucket, back to the default list", () => {
    expect(
      bucketsOf([
        { type: "addBucket", code: "EZ" },
        { type: "removeBucket", code: "EZ" },
      ]),
    ).toBeUndefined();
  });
});

describe("custom bucket refusals", () => {
  const nine: PoolOp[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((code) => ({
    type: "addBucket",
    code,
  }));

  it.each<[string, PoolOp[], string]>([
    ["a ninth custom bucket", nine, "too_many_buckets"],
    [
      "a code another bucket has",
      [nine[0] as PoolOp, { type: "addBucket", code: "a" }],
      "bad_bucket_code",
    ],
    ["a built-in's code", [{ type: "addBucket", code: "nm" }], "bad_bucket_code"],
    [
      "mods on a built-in",
      [{ type: "setSlotMods", bucket: "HD", mods: { kind: "free" } }],
      "not_custom",
    ],
    [
      "mods on no bucket",
      [{ type: "setSlotMods", bucket: "EZ", mods: { kind: "free" } }],
      "unknown_bucket",
    ],
    ["removing a built-in", [{ type: "removeBucket", code: "TB" }], "not_custom"],
    ["removing no bucket", [{ type: "removeBucket", code: "EZ" }], "unknown_bucket"],
    [
      "removing one with maps",
      [{ type: "addBucket", code: "EZ" }, add(1, "EZ"), { type: "removeBucket", code: "EZ" }],
      "bucket_not_empty",
    ],
  ])("refuses %s", (_case, ops, code) => {
    expect(failure(ops).code).toBe(code);
  });

  it("refuses a 100th map in one slot", () => {
    const pool: BuiltContent = { ...EMPTY, slots: [{ mod: "NM", index: 99, beatmapId: 1 }] };
    expect(failure([add(2)], pool).code).toBe("slot_full");
  });
});

describe("replaceMaps", () => {
  const paste = (text: string, mode?: "replace" | "merge"): PoolOp =>
    mode ? { type: "replaceMaps", text, mode } : { type: "replaceMaps", text };

  it("replaces every map, making custom buckets for new codes", () => {
    const result = run([add(7), paste("NM1 10\nhd1 11\nEZ1 https://osu.ppy.sh/b/12\n13, 14")]);
    if (!result.ok) throw new Error(result.code);
    expect(result.pool.slots.map((s) => `${s.mod ?? "-"}${s.index}:${s.beatmapId}`)).toEqual([
      "-1:13",
      "-2:14",
      "NM1:10",
      "HD1:11",
      "EZ1:12",
    ]);
    expect(result.pool.buckets?.map((b) => b.code)).toEqual([
      "NM",
      "HD",
      "HR",
      "DT",
      "FM",
      "EZ",
      "TB",
    ]);
  });

  it("merges into the maps by slot, and an empty paste clears the pool", () => {
    expect(slotsOf([add(1), add(2), paste("NM2 3\nHD1 4", "merge")])).toEqual([
      "NM1:1",
      "NM2:3",
      "HD1:4",
    ]);
    expect(slotsOf([add(1), paste("")])).toEqual([]);
  });

  it.each<[string, PoolOp[], string]>([
    ["a line it can't read", [paste("NM1 10\nhello")], "bad_paste"],
    ["a map twice", [paste("NM1 10\nHD1 10")], "duplicate"],
    ["a map the pool keeps", [add(10, "HD"), paste("NM1 10", "merge")], "duplicate"],
    ["a code through the filter", [paste("FAG1 10")], "content_filter"],
    [
      "65 maps",
      [paste(Array.from({ length: 65 }, (_, i) => String(i + 1)).join("\n"))],
      "too_many_maps",
    ],
    [
      "a ninth custom bucket",
      [paste("A1 1\nB1 2\nC1 3\nD1 4\nE1 5\nF1 6\nG1 7\nH1 8\nI1 9")],
      "too_many_buckets",
    ],
  ])("refuses %s", (_case, ops, code) => {
    expect(failure(ops).code).toBe(code);
  });

  it("names each line it couldn't read", () => {
    expect(failure([paste("NM1 10\nhello\nNM0 5")]).lines?.map((line) => line.line)).toEqual([
      2, 3,
    ]);
  });
});
