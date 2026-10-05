/**
 * @file src/utils/pool-snapshot.ts
 * @desc What a built pool's history keeps: details, buckets (always the full list), slots,
 *       targets and slot notes, as plain JSON. Candidates and votes stay out (working state,
 *       not the pool). POOL_CODEC keys slots by beatmap id (a pool never has a map twice) and
 *       buckets by code, and merges notes line by line. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { type BucketEntry, bucketsOf, canonicalBuckets, type PoolSlot } from "@haruhimemoe/pool";
import { type Codec, defineCodec } from "@haruhimemoe/vcs/json";
import type { BucketTargets, SlotNotes } from "@/schemas/built-plan";
import type { BuiltContent } from "@/utils/built-content";

/** A built pool as one revision holds it. */
export type PoolSnapshot = {
  name: string;
  tournament: string;
  round: string;
  year: number | null;
  notes: string;
  buckets: BucketEntry[];
  slots: PoolSlot[];
  targets: BucketTargets;
  slotNotes: SlotNotes;
};

/** Slots by beatmap id, buckets by code, notes merged by line. */
export const POOL_CODEC: Codec = defineCodec({
  lists: {
    slots: (slot: PoolSlot) => String(slot.beatmapId),
    buckets: (bucket: BucketEntry) => bucket.code,
  },
  text: ["notes"],
});

/**
 * @function snapshotOf
 * @param pool {BuiltContent} a pool's content
 * @returns {PoolSnapshot} its history snapshot (fresh JSON copies)
 */
export const snapshotOf = (pool: BuiltContent): PoolSnapshot => ({
  name: pool.name,
  tournament: pool.tournament,
  round: pool.round,
  year: pool.year,
  notes: pool.notes,
  buckets: structuredClone([...bucketsOf(pool)]),
  slots: pool.slots.map(({ mod, index, beatmapId }) => ({ mod, index, beatmapId })),
  targets: structuredClone(pool.targets ?? {}),
  slotNotes: { ...(pool.slotNotes ?? {}) },
});

/**
 * @function fromSnapshot
 * @param snapshot {PoolSnapshot} a revision's value
 * @returns {BuiltContent} the content to store: `buckets` left out for the default list, no
 *          candidates (the caller adds today's)
 */
export const fromSnapshot = (snapshot: PoolSnapshot): BuiltContent => {
  const buckets = canonicalBuckets(snapshot.buckets);
  return {
    name: snapshot.name,
    tournament: snapshot.tournament,
    round: snapshot.round,
    year: snapshot.year,
    notes: snapshot.notes,
    slots: snapshot.slots.map((slot) => ({ ...slot })),
    targets: structuredClone(snapshot.targets),
    slotNotes: { ...snapshot.slotNotes },
    ...(buckets ? { buckets } : {}),
  };
};
