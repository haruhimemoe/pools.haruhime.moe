/**
 * @file src/utils/candidate-list.ts
 * @desc The pieces the candidate ops share: a slot's list and pick, the pool's total, a list
 *       with one entry added or taken out, the refusals for a slot that can't take a candidate
 *       (no such bucket, its own pick, already there, 10 in the slot, 100 in the pool), finding a
 *       candidate, and a pick turned into a candidate. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { bucketsOf, findBucket } from "@haruhimemoe/pool";
import { CANDIDATE_MESSAGES, MAX_CANDIDATES, MAX_POOL_CANDIDATES } from "@/constants/candidates";
import { type Candidate, candidateKey, type SlotPlace } from "@/schemas/built-candidates";
import { type BuiltContent, OpError } from "@/utils/built-content";

/** Who makes a change and when (ISO text): candidates record both. */
export type Actor = { osuId: number; now: string };

/**
 * @function listAt
 * @param pool {BuiltContent} a pool
 * @param place {SlotPlace} a slot
 * @returns {Candidate[]} its candidates (empty when it has none)
 */
export const listAt = (pool: BuiltContent, place: SlotPlace): Candidate[] =>
  pool.candidates?.[candidateKey(place)] ?? [];

/**
 * @function pickAt
 * @param pool {BuiltContent} a pool
 * @param place {SlotPlace} a slot
 * @returns {PoolSlot | undefined} its pick, if it has one
 */
export const pickAt = (pool: BuiltContent, { bucket, index }: SlotPlace) =>
  pool.slots.find((slot) => slot.mod === bucket && slot.index === index);

/**
 * @function total
 * @param pool {BuiltContent} a pool
 * @returns {number} every candidate it holds
 */
export const total = (pool: BuiltContent): number =>
  Object.values(pool.candidates ?? {}).reduce((sum, list) => sum + list.length, 0);

/**
 * @function withList
 * @param pool {BuiltContent} a pool
 * @param place {SlotPlace} a slot
 * @param list {Candidate[]} its new list
 * @returns {BuiltContent} the pool with that slot's list replaced
 */
export const withList = (pool: BuiltContent, place: SlotPlace, list: Candidate[]) => ({
  ...pool,
  candidates: { ...pool.candidates, [candidateKey(place)]: list },
});

/**
 * @function inserted
 * @param list {Candidate[]} a list
 * @param entry {Candidate} a candidate
 * @param at {number | undefined} where (the end when left out)
 * @returns {Candidate[]} a new list with it
 */
export const inserted = (list: Candidate[], entry: Candidate, at?: number) => {
  const next = [...list];
  next.splice(at ?? next.length, 0, entry);
  return next;
};

/**
 * @function checkRoom
 * @param pool {BuiltContent} a pool
 * @param place {SlotPlace} a slot
 * @param beatmapId {number | null} the map (null: a demoted pick, never its own duplicate)
 * @returns {void} nothing when the slot can take it
 * @throws {OpError} unknown_bucket, candidate_is_pick, candidate_duplicate, candidate_full or candidate_pool_full
 */
export const checkRoom = (pool: BuiltContent, place: SlotPlace, beatmapId: number | null): void => {
  if (!findBucket(bucketsOf(pool), place.bucket)) {
    throw new OpError("unknown_bucket", `This pool has no slot called ${place.bucket}.`);
  }
  const list = listAt(pool, place);
  if (pickAt(pool, place)?.beatmapId === beatmapId) {
    throw new OpError("candidate_is_pick", CANDIDATE_MESSAGES.isPick);
  }
  if (list.some((entry) => entry.beatmapId === beatmapId)) {
    throw new OpError("candidate_duplicate", CANDIDATE_MESSAGES.already);
  }
  if (list.length >= MAX_CANDIDATES) throw new OpError("candidate_full", CANDIDATE_MESSAGES.full);
  if (total(pool) >= MAX_POOL_CANDIDATES) {
    throw new OpError("candidate_pool_full", CANDIDATE_MESSAGES.poolFull);
  }
};

/**
 * @function find
 * @param pool {BuiltContent} a pool
 * @param place {SlotPlace} a slot
 * @param beatmapId {number} a candidate's map
 * @returns {{ list: Candidate[]; at: number; entry: Candidate }} the list, its place and the candidate
 * @throws {OpError} unknown_candidate when it isn't there
 */
export const find = (pool: BuiltContent, place: SlotPlace, beatmapId: number) => {
  const list = listAt(pool, place);
  const at = list.findIndex((entry) => entry.beatmapId === beatmapId);
  const entry = list[at];
  if (!entry) throw new OpError("unknown_candidate", CANDIDATE_MESSAGES.unknown);
  return { list, at, entry };
};

/**
 * @function without
 * @param list {Candidate[]} a list
 * @param at {number} a place in it
 * @returns {Candidate[]} a new list without that entry
 */
export const without = (list: Candidate[], at: number) => list.filter((_, i) => i !== at);

/**
 * @function demoted
 * @param pool {BuiltContent} a pool
 * @param beatmapId {number} its pick's map
 * @param beatmapsetId {number | null | undefined} its set, when known
 * @param actor {Actor} who demotes it and when
 * @returns {Candidate} the pick as a candidate: its slot note, no votes
 */
export const demoted = (
  pool: BuiltContent,
  beatmapId: number,
  beatmapsetId: number | null | undefined,
  actor: Actor,
): Candidate => ({
  beatmapId,
  beatmapsetId: beatmapsetId ?? null,
  addedBy: actor.osuId,
  addedAt: actor.now,
  note: pool.slotNotes?.[String(beatmapId)] ?? "",
  votes: [],
});
