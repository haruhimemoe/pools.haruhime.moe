/**
 * @file src/utils/drag-move.ts
 * @desc Dragging a slot in the editor, the pure side: a slot dropped on a row takes that row's
 *       place (moveMap to its bucket and number: moving removes the slot first and later
 *       numbers close up, as the Up and Down buttons' moves do), dropped on another bucket goes
 *       to that bucket's end, and dropped on itself or its own bucket does nothing. A drop
 *       target is read from `data-drop-bucket` ("" for maps with no slot) and
 *       `data-drop-index` (a row). Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { PoolSlot } from "@haruhimemoe/pool";
import type { PoolOp } from "@/schemas/built-pool-ops";

/** Where a slot was dropped: a bucket (null: no slot), and a row's number or none. */
export type DropTarget = { bucket: string | null; index: number | null };

/**
 * @function dropOp
 * @param slot {PoolSlot} the slot dragged
 * @param target {DropTarget} where it was dropped
 * @returns {PoolOp | null} the move, or null when it stays where it is
 */
export const dropOp = (slot: PoolSlot, target: DropTarget): PoolOp | null => {
  const from = { bucket: slot.mod, index: slot.index };
  if (target.index === null) {
    return slot.mod === target.bucket
      ? null
      : { type: "moveMap", slot: from, bucket: target.bucket };
  }
  if (slot.mod === target.bucket && slot.index === target.index) return null;
  return { type: "moveMap", slot: from, bucket: target.bucket, index: target.index };
};

/**
 * @function readDropTarget
 * @param element {{ getAttribute(name: string): string | null } | null} the element under the
 *        pointer, or its closest drop target
 * @returns {DropTarget | null} the target it names, or null for none
 */
export const readDropTarget = (
  element: { getAttribute(name: string): string | null } | null,
): DropTarget | null => {
  const bucket = element?.getAttribute("data-drop-bucket") ?? null;
  if (bucket === null) return null;
  const index = Number(element?.getAttribute("data-drop-index") ?? Number.NaN);
  return { bucket: bucket === "" ? null : bucket, index: Number.isInteger(index) ? index : null };
};
