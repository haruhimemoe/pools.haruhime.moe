/**
 * @file tests/unit/utils/drag-move.test.ts
 * @desc Dragging a slot: dropped on a row it takes that row's place (moveMap to its bucket and
 *       number), dropped on another bucket it goes to that bucket's end, dropped on itself or its
 *       own bucket nothing happens.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { dropOp } from "@/utils/drag-move";

const NM3 = { mod: "NM", index: 3, beatmapId: 30 };

describe("dropOp", () => {
  it("takes a row's place, or goes to the end of another bucket", () => {
    expect(dropOp(NM3, { bucket: "NM", index: 1 })).toEqual({
      type: "moveMap",
      slot: { bucket: "NM", index: 3 },
      bucket: "NM",
      index: 1,
    });
    expect(dropOp(NM3, { bucket: "HD", index: null })).toEqual({
      type: "moveMap",
      slot: { bucket: "NM", index: 3 },
      bucket: "HD",
    });
    expect(dropOp(NM3, { bucket: null, index: 2 })).toMatchObject({ bucket: null, index: 2 });
  });

  it("does nothing on itself or its own bucket", () => {
    expect(dropOp(NM3, { bucket: "NM", index: 3 })).toBeNull();
    expect(dropOp(NM3, { bucket: "NM", index: null })).toBeNull();
  });
});
