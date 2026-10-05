/**
 * @file src/utils/built-editor.ts
 * @desc The builder's pure helpers: a change applied to the browser's copy of a pool (the
 *       server's own src/utils/built-ops.ts, so both agree on what a change does), the slots
 *       grouped by bucket in the pool's order (maps with no slot first), removal and the check's
 *       ids and rows, and what the summary says (star ranges per bucket, sets in the pool twice,
 *       maps played in past pools). Safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

import {
  type BucketEntry,
  bucketName,
  bucketsOf,
  isCustomBucket,
  type PoolSlot,
  slotLabel,
  slotModsFor,
  slotModsSummary,
} from "@haruhimemoe/pool";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { BuiltMaps, ClientPool } from "@/schemas/built-pool-view";
import type { OpFailure } from "@/utils/built-content";
import { applyOps } from "@/utils/built-ops";

/** Ops applied to the browser's copy, or the first that couldn't apply. */
export type LocalResult = { ok: true; pool: ClientPool } | OpFailure;

/**
 * @function applyLocal
 * @param pool {ClientPool} the browser's copy
 * @param ops {readonly PoolOp[]} a change
 * @returns {LocalResult} the copy with the change (a full bucket list, never left out), or why
 *          it can't apply, as the server would say
 */
export const applyLocal = (pool: ClientPool, ops: readonly PoolOp[]): LocalResult => {
  // The server records its own clock and the session's osu! id; the copy is replaced on save.
  const result = applyOps(pool, ops, { osuId: pool.me ?? 0, now: new Date().toISOString() });
  if (!result.ok) return result;
  const buckets = bucketsOf(result.pool).map((entry) => ({ ...entry }));
  return { ok: true, pool: { ...pool, ...result.pool, buckets } };
};

/** A bucket's slots, in order (code null: maps without a slot). */
export type SlotGroup = { code: string | null; entry: BucketEntry | null; slots: PoolSlot[] };

/**
 * @function groupSlots
 * @param pool {{ buckets: readonly BucketEntry[]; slots: readonly PoolSlot[] }} a pool
 * @returns {SlotGroup[]} maps with no slot (only when there are some), then every bucket in the
 *          pool's order, each with its maps by number
 */
export const groupSlots = (pool: {
  buckets: readonly BucketEntry[];
  slots: readonly PoolSlot[];
}): SlotGroup[] => {
  const of = (code: string | null) =>
    pool.slots.filter((slot) => slot.mod === code).sort((a, b) => a.index - b.index);
  const loose = of(null);
  const groups = pool.buckets.map((entry) => ({ code: entry.code, entry, slots: of(entry.code) }));
  return loose.length > 0 ? [{ code: null, entry: null, slots: loose }, ...groups] : groups;
};

/**
 * @function groupHeading
 * @param entry {BucketEntry | null} a bucket, or null for maps with no slot
 * @returns {{ title: string; detail: string | null }} its code and what it plays with
 */
export const groupHeading = (
  entry: BucketEntry | null,
): { title: string; detail: string | null } => {
  if (entry === null) return { title: bucketName(null), detail: null };
  if (!isCustomBucket(entry)) return { title: entry.code, detail: bucketName(entry) };
  return { title: entry.code, detail: slotModsSummary(slotModsFor(entry)) ?? "No mods" };
};

const ref = (slot: PoolSlot) => ({ bucket: slot.mod, index: slot.index });

/**
 * @function removeOp
 * @param slot {PoolSlot} the slot to empty
 * @returns {PoolOp} its removal
 */
export const removeOp = (slot: PoolSlot): PoolOp => ({ type: "removeMap", slot: ref(slot) });

/**
 * @function unknownMapIds
 * @param slots {readonly PoolSlot[]} a pool's slots
 * @param maps {BuiltMaps} the details held so far
 * @returns {number[]} ids never asked about, ascending
 */
export const unknownMapIds = (slots: readonly PoolSlot[], maps: BuiltMaps): number[] =>
  [...new Set(slots.map((slot) => slot.beatmapId))]
    .filter((id) => !(id in maps))
    .sort((a, b) => a - b);

/**
 * @function checkIdsOf
 * @param slots {readonly PoolSlot[]} a pool's slots
 * @returns {number[]} its beatmap ids, ascending (the check's shared CDN answer needs the order)
 */
export const checkIdsOf = (slots: readonly PoolSlot[]): number[] =>
  [...new Set(slots.map((slot) => slot.beatmapId))].sort((a, b) => a - b);

/**
 * @function checkRowsOf
 * @param slots {readonly PoolSlot[]} a pool's slots, in order
 * @returns {{ label: string; beatmapId: number }[]} the check's rows, one per slot
 */
export const checkRowsOf = (slots: readonly PoolSlot[]) =>
  slots.map((slot) => ({ label: slotLabel(slot), beatmapId: slot.beatmapId }));
