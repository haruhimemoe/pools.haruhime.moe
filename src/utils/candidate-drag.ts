/**
 * @file src/utils/candidate-drag.ts
 * @desc Drag and drop between picks and candidates, the pure side. A pick dropped on its own
 *       slot's candidate list is demoted; on another slot's list in its bucket it's demoted and
 *       moved there. A candidate dropped on a slot's pick row (or an empty slot) in its bucket is
 *       promoted there (moved first when it's another slot); dropped on another slot's list it
 *       moves there. Anything across buckets, or onto where it already is, does nothing: a
 *       candidate is judged under its bucket's mods. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import type { DragItem, DropTarget } from "@/utils/drag-move";

/**
 * @function candidateDropOps
 * @param item {DragItem} what was dragged (a pick, or a candidate with its slot)
 * @param target {DropTarget} where it was dropped
 * @param maps {BuiltMaps} map details (a demoted pick keeps its set for the cover)
 * @returns {PoolOp[] | null} the ops, or null when this drop isn't about candidates (a pick onto
 *          a row or bucket: src/utils/drag-move.ts) or does nothing
 */
export const candidateDropOps = (
  item: DragItem,
  target: DropTarget,
  maps: BuiltMaps,
): PoolOp[] | null => {
  const { mod: bucket, index, beatmapId } = item;
  if (bucket === null || target.bucket !== bucket || target.index === null) return null;
  const slot = { bucket, index };
  const to = target.index;
  if (!item.candidate) {
    if (target.zone !== "candidates") return null;
    const beatmapsetId = maps[beatmapId]?.setId ?? null;
    const demote: PoolOp = { type: "demotePick", slot, beatmapsetId };
    return to === index ? [demote] : [demote, { type: "moveCandidate", slot, beatmapId, to }];
  }
  if (target.zone === "candidates") {
    return to === index ? null : [{ type: "moveCandidate", slot, beatmapId, to }];
  }
  const promote = (at: number): PoolOp => ({
    type: "promoteCandidate",
    slot: { bucket, index: at },
    beatmapId,
  });
  return to === index
    ? [promote(to)]
    : [{ type: "moveCandidate", slot, beatmapId, to }, promote(to)];
};

/**
 * @function withPickSet
 * @param ops {PoolOp[]} ops from candidateDropOps
 * @param pickAt {(place: { bucket: string; index: number }) => number | null} a slot's pick
 * @param maps {BuiltMaps} map details
 * @returns {PoolOp[]} the same ops, each promote carrying the set of the pick it replaces, so its
 *          cover shows once it's a candidate
 */
export const withPickSet = (
  ops: PoolOp[],
  pickAt: (place: { bucket: string; index: number }) => number | null,
  maps: BuiltMaps,
): PoolOp[] =>
  ops.map((op) => {
    if (op.type !== "promoteCandidate") return op;
    const pick = pickAt(op.slot);
    return pick === null ? op : { ...op, pickSetId: maps[pick]?.setId ?? null };
  });
