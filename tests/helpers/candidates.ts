/**
 * @file tests/helpers/candidates.ts
 * @desc A small built pool's content with candidates for the candidate tests: NM1 and NM2 with
 *       picks, NM1 with two candidates (one noted, one voted), NM4 with a candidate and no pick,
 *       HD1 with a pick; and candidate rows made the same way everywhere.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BucketEntry } from "@haruhimemoe/pool";
import type { Candidate } from "@/schemas/built-candidates";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltContent } from "@/utils/built-content";
import { applyOps } from "@/utils/built-ops";
import type { Actor } from "@/utils/candidate-ops";

/** The six built-in buckets. */
export const BUILT_IN = ["NM", "HD", "HR", "DT", "FM", "TB"].map((code) => ({
  code,
})) as BucketEntry[];

/** Who acts in the tests, and when. */
export const ME: Actor = { osuId: 7, now: "2026-09-28T12:00:00.000Z" };

/**
 * @function candidate
 * @param beatmapId {number} its map (its set is the map id times ten)
 * @param extra {Partial<Candidate>} anything else
 * @returns {Candidate} a candidate added by osu! id 7
 */
export const candidate = (beatmapId: number, extra: Partial<Candidate> = {}): Candidate => ({
  beatmapId,
  beatmapsetId: beatmapId * 10,
  addedBy: 7,
  addedAt: "2026-09-27T10:00:00.000Z",
  note: "",
  votes: [],
  ...extra,
});

/** The pool the candidate tests start from. */
export const WITH_CANDIDATES: BuiltContent = {
  name: "Cup",
  tournament: "",
  round: "",
  year: null,
  notes: "",
  buckets: BUILT_IN,
  slots: [
    { mod: "NM", index: 1, beatmapId: 10 },
    { mod: "NM", index: 2, beatmapId: 20 },
    { mod: "HD", index: 1, beatmapId: 30 },
  ],
  targets: {},
  slotNotes: { 10: "the opener" },
  candidates: {
    "NM:1": [candidate(11, { note: "safer" }), candidate(12, { votes: [7, 8] })],
    "NM:4": [candidate(41)],
  },
};

/**
 * @function applied
 * @param pool {BuiltContent} a pool
 * @param ops {readonly PoolOp[]} ops that should apply
 * @param actor {Actor} who makes them
 * @returns {BuiltContent} the pool after them
 * @throws {Error} naming the refusal when they don't apply
 */
export const applied = (pool: BuiltContent, ops: readonly PoolOp[], actor: Actor = ME) => {
  const result = applyOps(pool, ops, actor);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.pool;
};
