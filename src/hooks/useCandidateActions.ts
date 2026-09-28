/**
 * @file src/hooks/useCandidateActions.ts
 * @desc The editor's candidate actions as ops: promote (carrying the set of the pick it
 *       replaces, for its cover), remove, vote, note and demote a pick (carrying its set), and a
 *       drop between picks and candidates (src/utils/candidate-drag.ts). Nothing when the pool
 *       holds no candidates field (it isn't the editor's copy).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltMaps, ClientPool } from "@/schemas/built-pool-view";
import type { CandidateContext } from "@/schemas/candidate-editor";
import { candidateDropOps, withPickSet } from "@/utils/candidate-drag";
import type { DragItem, DropTarget } from "@/utils/drag-move";

/** The editor's candidate context, and what a drop that concerns candidates does. */
export type CandidateActionsResult = {
  context: CandidateContext | undefined;
  /** Runs a drop between picks and candidates; false when the drop isn't one. */
  drop: (item: DragItem, target: DropTarget) => boolean;
};

/**
 * @function useCandidateActions
 * @param pool {ClientPool} the editor's copy
 * @param maps {BuiltMaps} map details (sets for covers)
 * @param change {(ops: PoolOp[]) => boolean} the editor's change call
 * @returns {CandidateActionsResult} the context for the bucket rows, and the drop handler
 */
export const useCandidateActions = (
  pool: ClientPool,
  maps: BuiltMaps,
  change: (ops: PoolOp[]) => boolean,
): CandidateActionsResult => {
  const pickAt = ({ bucket, index }: { bucket: string; index: number }) =>
    pool.slots.find((slot) => slot.mod === bucket && slot.index === index)?.beatmapId ?? null;
  const setOf = (id: number) => maps[id]?.setId ?? null;
  const drop = (item: DragItem, target: DropTarget): boolean => {
    const ops = candidateDropOps(item, target, maps);
    if (ops) change(withPickSet(ops, pickAt, maps));
    return ops !== null || item.candidate === true;
  };
  if (!pool.candidates) return { context: undefined, drop };
  const context: CandidateContext = {
    candidates: pool.candidates,
    members: [...(pool.owner ? [pool.owner] : []), ...pool.editors],
    me: pool.me,
    onPromote: (slot, entry) => {
      const pick = pickAt(slot);
      const set = pick === null ? {} : { pickSetId: setOf(pick) };
      change([{ type: "promoteCandidate", slot, beatmapId: entry.beatmapId, ...set }]);
    },
    onRemove: (slot, entry) =>
      change([{ type: "removeCandidate", slot, beatmapId: entry.beatmapId }]),
    onVote: (slot, entry, on) =>
      change([{ type: "voteCandidate", slot, beatmapId: entry.beatmapId, on }]),
    onNote: (slot, entry, note) =>
      change([{ type: "setCandidateNote", slot, beatmapId: entry.beatmapId, note }]),
    onDemote: (pick) => {
      if (pick.mod === null) return;
      const slot = { bucket: pick.mod, index: pick.index };
      change([{ type: "demotePick", slot, beatmapsetId: setOf(pick.beatmapId) }]);
    },
  };
  return { context, drop };
};
