/**
 * @file tests/unit/utils/built-editor.test.ts
 * @desc The builder's helpers: a change applied to the browser's copy (a full bucket list back,
 *       the server's refusals), slots grouped in the pool's order with no-slot maps first,
 *       headings, the move ops (a swap even with gaps in the numbers), and the ids for the map
 *       details and the check.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { type PoolSlot, sortSlots } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import type { ClientPool } from "@/schemas/built-pool-view";
import {
  applyLocal,
  checkIdsOf,
  checkRowsOf,
  groupHeading,
  groupSlots,
  moveToOp,
  moveWithinOp,
  removeOp,
  unknownMapIds,
} from "@/utils/built-editor";

const DEFAULT = ["NM", "HD", "HR", "DT", "FM", "TB"].map((code) => ({
  code,
})) as ClientPool["buckets"];

const pool = (slots: PoolSlot[], buckets = DEFAULT): ClientPool => ({
  id: "b-a0000001",
  name: "Cup",
  tournament: "",
  round: "",
  year: null,
  notes: "",
  visibility: "private",
  hidden: false,
  owner: { osuId: 1, username: "owner" },
  editors: [],
  buckets,
  slots,
  version: 1,
  pack: { state: "none", href: null, error: null, gone: false, retry: true },
  access: { isOwner: true, isEditor: false, canEdit: true, canManage: true, canDelete: true },
});

const nm = (index: number, beatmapId: number): PoolSlot => ({ mod: "NM", index, beatmapId });

describe("applyLocal", () => {
  it("applies a change and keeps the full bucket list", () => {
    const withCustom = applyLocal(pool([]), [
      { type: "addBucket", code: "EX", mods: { kind: "forced", set: ["HD", "HR"] } },
      { type: "addMap", beatmapId: 5, bucket: "EX" },
    ]);
    expect(withCustom.ok && withCustom.pool.buckets.map((b) => b.code)).toEqual([
      "NM",
      "HD",
      "HR",
      "DT",
      "FM",
      "EX",
      "TB",
    ]);
    if (!withCustom.ok) return;
    const removed = applyLocal(withCustom.pool, [
      { type: "removeMap", slot: { bucket: "EX", index: 1 } },
      { type: "removeBucket", code: "EX" },
    ]);
    expect(removed.ok && removed.pool.buckets).toEqual(DEFAULT);
  });

  it("refuses as the server would", () => {
    const result = applyLocal(pool([nm(1, 5)]), [{ type: "addMap", beatmapId: 5, bucket: "HD" }]);
    expect(result).toMatchObject({ ok: false, code: "duplicate", op: 0 });
    const paste = applyLocal(pool([]), [{ type: "replaceMaps", text: "NM1 5\nnot a map" }]);
    expect(paste).toMatchObject({ ok: false, code: "bad_paste", lines: [{ line: 2 }] });
  });
});

describe("groupSlots and groupHeading", () => {
  it("lists no-slot maps first, then every bucket in order with its maps by number", () => {
    const slots = [nm(2, 7), { mod: null, index: 1, beatmapId: 9 }, nm(1, 8)];
    const groups = groupSlots(pool(slots));
    expect(groups.map((g) => g.code)).toEqual([null, "NM", "HD", "HR", "DT", "FM", "TB"]);
    expect(groups[1]?.slots.map((s) => s.beatmapId)).toEqual([8, 7]);
    expect(groupSlots(pool([nm(1, 8)]))[0]?.code).toBe("NM");
  });

  it("names a group and what it plays with", () => {
    expect(groupHeading(null)).toEqual({ title: "No slot", detail: null });
    expect(groupHeading({ code: "HR" })).toEqual({ title: "HR", detail: "Hard Rock" });
    expect(groupHeading({ code: "EX", color: 0 })).toEqual({ title: "EX", detail: "No mods" });
    expect(
      groupHeading({ code: "EX", color: 0, mods: { kind: "forced", set: ["HD", "HR"] } }),
    ).toEqual({ title: "EX", detail: "Forced HD HR" });
  });
});

describe("move ops", () => {
  const moved = (slots: PoolSlot[], op: ReturnType<typeof moveWithinOp>) => {
    const result = op ? applyLocal(pool(slots), [op]) : null;
    return result?.ok ? result.pool.slots.map((s) => `${s.mod}${s.index}:${s.beatmapId}`) : null;
  };

  it("swaps a slot with its neighbor, and does nothing at the ends", () => {
    const slots = [nm(1, 10), nm(2, 20), nm(3, 30)];
    const second = slots[1] as PoolSlot;
    expect(moved(slots, moveWithinOp(slots, second, "up"))).toEqual(["NM1:20", "NM2:10", "NM3:30"]);
    expect(moved(slots, moveWithinOp(slots, second, "down"))).toEqual([
      "NM1:10",
      "NM2:30",
      "NM3:20",
    ]);
    expect(moveWithinOp(slots, slots[0] as PoolSlot, "up")).toBeNull();
    expect(moveWithinOp(slots, slots[2] as PoolSlot, "down")).toBeNull();
    expect(moveWithinOp(slots, nm(9, 99), "up")).toBeNull();
  });

  it("swaps across a gap in the numbers", () => {
    const slots = [nm(1, 10), nm(3, 30)];
    const up = moved(slots, moveWithinOp(slots, slots[1] as PoolSlot, "up"));
    expect(up).toEqual(["NM1:30", "NM2:10"]);
    const down = moved(slots, moveWithinOp(slots, slots[0] as PoolSlot, "down"));
    expect(down).toEqual(["NM2:30", "NM3:10"]);
  });

  it("moves to the end of another bucket, and removes", () => {
    const slots = sortSlots([nm(1, 10), { mod: "HD", index: 1, beatmapId: 40 }]);
    expect(moveToOp(slots[0] as PoolSlot, "HD")).toEqual({
      type: "moveMap",
      slot: { bucket: "NM", index: 1 },
      bucket: "HD",
    });
    expect(moveToOp(slots[0] as PoolSlot, "NM")).toBeNull();
    expect(removeOp(nm(2, 5))).toEqual({ type: "removeMap", slot: { bucket: "NM", index: 2 } });
  });
});

describe("ids", () => {
  const slots = [nm(1, 30), { mod: "HD", index: 1, beatmapId: 10 }, nm(2, 20)];

  it("finds the maps never asked about", () => {
    expect(unknownMapIds(slots, { 20: null })).toEqual([10, 30]);
  });

  it("gives the check ascending ids and a row per slot", () => {
    expect(checkIdsOf(slots)).toEqual([10, 20, 30]);
    expect(checkRowsOf(slots)).toEqual([
      { label: "NM1", beatmapId: 30 },
      { label: "HD1", beatmapId: 10 },
      { label: "NM2", beatmapId: 20 },
    ]);
  });
});
