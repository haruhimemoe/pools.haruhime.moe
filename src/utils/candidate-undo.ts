/**
 * @file src/utils/candidate-undo.ts
 * @desc Undo for the candidate ops, the pure side src/utils/undo.ts calls: each op's inverse from
 *       the pool just before it (an added candidate is removed; a removed one comes back in its
 *       place with its set and note; a promote is undone by promoting the old pick back, or by
 *       demoting the new pick to its old place when there was none; a demoted pick is promoted
 *       back; a note gets its old text; a vote its old state; a move goes back to its old slot and
 *       place). Undo compares candidates by map, set and note only (candidatesForUndo): who added
 *       one and when, and its votes, can't be put back by an op, so an undone removal comes back
 *       as yours, with no votes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { candidateKey, type SlotCandidates, type SlotPlace } from "@/schemas/built-candidates";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltContent } from "@/utils/built-content";
import type { Actor, CandidateOp } from "@/utils/candidate-ops";

const entryOf = (pool: BuiltContent, place: SlotPlace, beatmapId: number) => {
  const list = pool.candidates?.[candidateKey(place)] ?? [];
  const at = list.findIndex((entry) => entry.beatmapId === beatmapId);
  const entry = list[at];
  return entry ? { at, entry } : null;
};

const pickOf = (pool: BuiltContent, { bucket, index }: SlotPlace) =>
  pool.slots.find((slot) => slot.mod === bucket && slot.index === index);

/**
 * @function candidateInverse
 * @param before {BuiltContent} the pool just before the op
 * @param op {CandidateOp} a candidate op that applied
 * @param actor {Actor} who made it (a vote's old state is theirs)
 * @returns {PoolOp[] | null} the ops that undo it, or null when there are none
 */
export const candidateInverse = (
  before: BuiltContent,
  op: CandidateOp,
  actor: Actor,
): PoolOp[] | null => {
  const { slot } = op;
  if (op.type === "addCandidate") {
    return [{ type: "removeCandidate", slot, beatmapId: op.beatmapId }];
  }
  if (op.type === "demotePick") {
    const pick = pickOf(before, slot);
    return pick ? [{ type: "promoteCandidate", slot, beatmapId: pick.beatmapId }] : null;
  }
  const found = entryOf(before, slot, op.beatmapId);
  if (!found) return null;
  const { at, entry } = found;
  switch (op.type) {
    case "removeCandidate": {
      const note = entry.note ? { note: entry.note } : {};
      const set = entry.beatmapsetId;
      return [
        { type: "addCandidate", slot, beatmapId: entry.beatmapId, beatmapsetId: set, ...note, at },
      ];
    }
    case "promoteCandidate": {
      const old = pickOf(before, slot);
      const set = entry.beatmapsetId;
      return old
        ? [{ type: "promoteCandidate", slot, beatmapId: old.beatmapId, pickSetId: set }]
        : [{ type: "demotePick", slot, beatmapsetId: set, at }];
    }
    case "setCandidateNote":
      return [{ type: "setCandidateNote", slot, beatmapId: op.beatmapId, note: entry.note }];
    case "voteCandidate":
      return [
        {
          type: "voteCandidate",
          slot,
          beatmapId: op.beatmapId,
          on: entry.votes.includes(actor.osuId),
        },
      ];
    case "moveCandidate": {
      if (op.to === slot.index) return null;
      const to = { bucket: slot.bucket, index: op.to };
      return [{ type: "moveCandidate", slot: to, beatmapId: op.beatmapId, to: slot.index, at }];
    }
  }
};

/**
 * @function candidatesForUndo
 * @param candidates {SlotCandidates | undefined} a pool's candidates
 * @returns {Record<string, { beatmapId: number; beatmapsetId: number | null; note: string }[]>}
 *          what undo compares: each slot's maps, sets and notes in order
 */
export const candidatesForUndo = (candidates: SlotCandidates | undefined) =>
  Object.fromEntries(
    Object.entries(candidates ?? {}).map(([key, list]) => [
      key,
      list.map(({ beatmapId, beatmapsetId, note }) => ({ beatmapId, beatmapsetId, note })),
    ]),
  );
