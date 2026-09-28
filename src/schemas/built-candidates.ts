/**
 * @file src/schemas/built-candidates.ts
 * @desc A built pool's candidates, kept by slot: `candidates: { "<bucket>:<number>": Candidate[] }`
 *       (a slot's own key, so a slot with no pick can still hold them). Each candidate is its map,
 *       its set (for the cover), who added it (osu! id) and when (ISO text), a note (0 to 280
 *       characters on one line, through the content filter) and the osu! ids that voted for it.
 *       The field is left out when there are none, so pools stored before it read as having none.
 *       Writes check: a slot key names a bucket the pool has (never the no-slot group), at most
 *       10 per slot and 100 per pool, no map twice in a slot, and never the slot's own pick.
 *       Reads check shape only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  BUCKET_CODE_PATTERN,
  type BucketEntry,
  beatmapIdSchema,
  bucketsOf,
  findBucket,
  MAX_SLOT_INDEX,
  type PoolSlot,
} from "@haruhimemoe/pool";
import { z } from "zod";
import { MAX_EDITORS } from "@/constants/built-pools";
import { MAX_CANDIDATES, MAX_POOL_CANDIDATES } from "@/constants/candidates";
import { slotNoteSchema } from "@/schemas/built-plan";

/** One candidate as stored. */
export const candidateSchema = z.object({
  beatmapId: beatmapIdSchema,
  /** Its set, for the cover; null when it wasn't known (a pick whose details hadn't loaded). */
  beatmapsetId: z.number().int().positive().nullable(),
  /** osu! id of whoever added it (0 only in a browser's copy before it saves). */
  addedBy: z.number().int().nonnegative(),
  addedAt: z.iso.datetime(),
  note: slotNoteSchema,
  votes: z.array(z.number().int().positive()).max(MAX_EDITORS + 1),
});

/** A slot's candidate. */
export type Candidate = z.infer<typeof candidateSchema>;

/** Candidates by slot key ("NM:2"). */
export type SlotCandidates = Readonly<Record<string, Candidate[]>>;

/** Candidates as written. */
export const slotCandidatesSchema = z.record(z.string(), z.array(candidateSchema));

/** Candidates as read: shape only, so a row a newer rule would refuse still reads. */
export const slotCandidatesShape = z.record(
  z.string(),
  z.array(
    z.object({
      beatmapId: z.number(),
      beatmapsetId: z.number().nullable(),
      addedBy: z.number(),
      addedAt: z.string(),
      note: z.string(),
      votes: z.array(z.number()),
    }),
  ),
);

/** A slot's place: its bucket code and number. */
export type SlotPlace = { bucket: string; index: number };

/**
 * @function candidateKey
 * @param place {SlotPlace} a slot
 * @returns {string} its key in `candidates` ("NM:2")
 */
export const candidateKey = ({ bucket, index }: SlotPlace): string => `${bucket}:${index}`;

/**
 * @function placeOfKey
 * @param key {string} a key in `candidates`
 * @returns {SlotPlace | null} the slot it names, or null for a key of the wrong shape
 */
export const placeOfKey = (key: string): SlotPlace | null => {
  const cut = key.lastIndexOf(":");
  const [bucket, number] = [key.slice(0, cut), key.slice(cut + 1)];
  if (cut < 1 || !BUCKET_CODE_PATTERN.test(bucket) || !/^\d{1,2}$/.test(number)) return null;
  const index = Number(number);
  return index >= 1 && index <= MAX_SLOT_INDEX ? { bucket, index } : null;
};

const pickAt = (slots: readonly PoolSlot[], { bucket, index }: SlotPlace) =>
  slots.find((slot) => slot.mod === bucket && slot.index === index);

/** Why a pool's candidates can't be stored, or null. */
const candidatesProblem = (pool: {
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[] | undefined;
  candidates?: SlotCandidates | undefined;
}): string | null => {
  const list = bucketsOf(pool);
  let total = 0;
  for (const [key, entries] of Object.entries(pool.candidates ?? {})) {
    const place = placeOfKey(key);
    if (!place || !findBucket(list, place.bucket))
      return "A candidate is in a slot that isn't here.";
    if (entries.length === 0) return "A slot has an empty candidate list.";
    if (entries.length > MAX_CANDIDATES) return "A slot has too many candidates.";
    const ids = new Set(entries.map((entry) => entry.beatmapId));
    if (ids.size !== entries.length) return "A map is a candidate twice in one slot.";
    const pick = pickAt(pool.slots, place);
    if (pick && ids.has(pick.beatmapId)) return "A map is a slot's pick and its candidate.";
    total += entries.length;
  }
  return total > MAX_POOL_CANDIDATES ? "The pool has too many candidates." : null;
};

/**
 * @function checkCandidates
 * @param pool {{ slots; buckets?; candidates? }} a parsed pool
 * @param ctx {z.RefinementCtx} zod refinement context
 * @returns {void} adds an issue for candidates the pool can't store (see the file's rules)
 */
export const checkCandidates = (
  pool: {
    slots: readonly PoolSlot[];
    buckets?: readonly BucketEntry[] | undefined;
    candidates?: SlotCandidates | undefined;
  },
  ctx: z.RefinementCtx,
): void => {
  const problem = candidatesProblem(pool);
  if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["candidates"] });
};
