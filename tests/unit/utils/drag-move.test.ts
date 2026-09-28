/**
 * @file tests/unit/utils/drag-move.test.ts
 * @desc Dragging a slot: dropped on a row it takes that row's place (moveMap to its bucket and
 *       number), dropped on another bucket it goes to that bucket's end, dropped on itself or its
 *       own bucket nothing happens; a drop target is read from the element's data attributes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { dropOp, readDropTarget } from "@/utils/drag-move";

const NM3 = { mod: "NM", index: 3, beatmapId: 30 };
const el = (attrs: Record<string, string>) => ({
  getAttribute: (name: string) => attrs[name] ?? null,
});

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

describe("readDropTarget", () => {
  it("reads a row, a bucket, and no slot", () => {
    expect(readDropTarget(el({ "data-drop-bucket": "HD", "data-drop-index": "2" }))).toEqual({
      bucket: "HD",
      index: 2,
    });
    expect(readDropTarget(el({ "data-drop-bucket": "DT" }))).toEqual({ bucket: "DT", index: null });
    expect(readDropTarget(el({ "data-drop-bucket": "" }))).toEqual({ bucket: null, index: null });
    expect(readDropTarget(el({}))).toBeNull();
    expect(readDropTarget(null)).toBeNull();
  });
});
