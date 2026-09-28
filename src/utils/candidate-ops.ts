/**
 * @file src/utils/candidate-ops.ts
 * @desc The candidate ops on a built pool's content: add (refused past 10 in a slot or 100 in the
 *       pool, for a map already there, or for the slot's own pick), remove, promote (the
 *       candidate becomes the pick and its note the slot's note; the old pick, if any, takes its
 *       place in the list with its note), demote the pick (it joins the list, the slot keeps no
 *       pick), set a note, vote (one per person, by osu! id) and move to another slot of the same
 *       bucket (note, adder and votes kept). Who acts and when come from the caller (the server's
 *       session and clock; the browser's own copy uses the same rules). After every op,
 *       tidyCandidates drops lists on buckets the pool no longer has, candidates that became
 *       their slot's pick, and empty lists. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { bucketsOf, findBucket, MAX_SLOTS } from "@haruhimemoe/pool";
import { CANDIDATE_MESSAGES } from "@/constants/candidates";
import {
  type Candidate,
  placeOfKey,
  type SlotCandidates,
  type SlotPlace,
} from "@/schemas/built-candidates";
import type { PoolOp } from "@/schemas/built-pool-ops";
import { type BuiltContent, OP_MESSAGES, OpError } from "@/utils/built-content";
import {
  type Actor,
  checkRoom,
  demoted,
  find,
  inserted,
  listAt,
  pickAt,
  withList,
  without,
} from "@/utils/candidate-list";
import { rowsOf, withRows } from "@/utils/slot-rows";

export type { Actor } from "@/utils/candidate-list";

/** An actor for pure checks (undo, the activity log), where who and when don't matter. */
export const NO_ACTOR: Actor = { osuId: 0, now: new Date(0).toISOString() };

/** The candidate ops' types. */
export type CandidateOp = Extract<
  PoolOp,
  {
    type:
      | "addCandidate"
      | "removeCandidate"
      | "promoteCandidate"
      | "demotePick"
      | "setCandidateNote"
      | "voteCandidate"
      | "moveCandidate";
  }
>;

const CANDIDATE_OPS = new Set<string>([
  "addCandidate",
  "removeCandidate",
  "promoteCandidate",
  "demotePick",
  "setCandidateNote",
  "voteCandidate",
  "moveCandidate",
]);

/**
 * @function isCandidateOp
 * @param op {PoolOp} an op
 * @returns {boolean} true for the candidate ops
 */
export const isCandidateOp = (op: PoolOp): op is CandidateOp => CANDIDATE_OPS.has(op.type);

const promote = (
  pool: BuiltContent,
  op: Extract<CandidateOp, { type: "promoteCandidate" }>,
  actor: Actor,
): BuiltContent => {
  const { list, at, entry } = find(pool, op.slot, op.beatmapId);
  const old = pickAt(pool, op.slot);
  if (pool.slots.some((slot) => slot.beatmapId === entry.beatmapId)) {
    throw new OpError("duplicate", OP_MESSAGES.duplicate);
  }
  if (!old && pool.slots.length >= MAX_SLOTS) {
    throw new OpError("too_many_maps", OP_MESSAGES.tooManyMaps);
  }
  const { [String(entry.beatmapId)]: _, ...notes } = pool.slotNotes ?? {};
  const list2 = old
    ? list.map((c, i) => (i === at ? demoted(pool, old.beatmapId, op.pickSetId, actor) : c))
    : without(list, at);
  const rows = new Map(rowsOf(pool, op.slot.bucket));
  rows.set(op.slot.index, { pick: entry.beatmapId, list: list2 });
  const next = withRows(pool, op.slot.bucket, rows);
  const note = entry.note ? { [String(entry.beatmapId)]: entry.note } : {};
  return { ...next, slotNotes: { ...notes, ...note } };
};

const demote = (
  pool: BuiltContent,
  op: Extract<CandidateOp, { type: "demotePick" }>,
  actor: Actor,
): BuiltContent => {
  const pick = pickAt(pool, op.slot);
  if (!pick) throw new OpError("no_pick", CANDIDATE_MESSAGES.noPick);
  checkRoom(pool, op.slot, null);
  const list = inserted(
    listAt(pool, op.slot),
    demoted(pool, pick.beatmapId, op.beatmapsetId, actor),
    op.at,
  );
  const rows = new Map(rowsOf(pool, op.slot.bucket));
  return withRows(pool, op.slot.bucket, rows.set(op.slot.index, { pick: null, list }));
};

const move = (pool: BuiltContent, op: Extract<CandidateOp, { type: "moveCandidate" }>) => {
  const { list, at, entry } = find(pool, op.slot, op.beatmapId);
  if (op.to === op.slot.index) return pool;
  const to = { bucket: op.slot.bucket, index: op.to };
  const left = withList(pool, op.slot, without(list, at));
  checkRoom(left, to, entry.beatmapId);
  return withList(left, to, inserted(listAt(left, to), entry, op.at));
};

const edited = (
  pool: BuiltContent,
  place: SlotPlace,
  beatmapId: number,
  change: (entry: Candidate) => Candidate,
): BuiltContent => {
  const { list, at, entry } = find(pool, place, beatmapId);
  return withList(
    pool,
    place,
    list.map((c, i) => (i === at ? change(entry) : c)),
  );
};

/**
 * @function applyCandidateOp
 * @param pool {BuiltContent} the pool's content
 * @param op {CandidateOp} one candidate op
 * @param actor {Actor} who makes it and when
 * @returns {BuiltContent} the content after it
 * @throws {OpError} when the op can't apply (a full slot, an unknown candidate, no pick)
 */
export const applyCandidateOp = (
  pool: BuiltContent,
  op: CandidateOp,
  actor: Actor,
): BuiltContent => {
  switch (op.type) {
    case "addCandidate": {
      checkRoom(pool, op.slot, op.beatmapId);
      const entry: Candidate = {
        beatmapId: op.beatmapId,
        beatmapsetId: op.beatmapsetId,
        addedBy: actor.osuId,
        addedAt: actor.now,
        note: op.note ?? "",
        votes: [],
      };
      return withList(pool, op.slot, inserted(listAt(pool, op.slot), entry, op.at));
    }
    case "removeCandidate": {
      const { list, at } = find(pool, op.slot, op.beatmapId);
      return withList(pool, op.slot, without(list, at));
    }
    case "promoteCandidate":
      return promote(pool, op, actor);
    case "demotePick":
      return demote(pool, op, actor);
    case "setCandidateNote":
      return edited(pool, op.slot, op.beatmapId, (entry) => ({ ...entry, note: op.note }));
    case "voteCandidate":
      return edited(pool, op.slot, op.beatmapId, (entry) => {
        const others = entry.votes.filter((id) => id !== actor.osuId);
        return { ...entry, votes: op.on ? [...others, actor.osuId] : others };
      });
    case "moveCandidate":
      return move(pool, op);
  }
};

/**
 * @function tidyCandidates
 * @param pool {BuiltContent} content after an op
 * @returns {SlotCandidates} its candidates without lists on buckets it no longer has, candidates
 *          that are now their slot's pick, and empty lists
 */
export const tidyCandidates = (pool: BuiltContent): SlotCandidates => {
  const list = bucketsOf(pool);
  const kept: Record<string, Candidate[]> = {};
  for (const [key, entries] of Object.entries(pool.candidates ?? {})) {
    const place = placeOfKey(key);
    if (!place || !findBucket(list, place.bucket)) continue;
    const pick = pickAt(pool, place)?.beatmapId;
    const left = entries.filter((entry) => entry.beatmapId !== pick);
    if (left.length > 0) kept[key] = left;
  }
  return kept;
};
