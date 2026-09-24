/**
 * @file src/utils/fingerprint.ts
 * @desc A pool's identity: the fingerprint, sha256 of its sorted "beatmapId:mods" lines (what
 *       each slot plays with, src/utils/slot-mods.ts). The same maps with the same mods, in any
 *       order, under any labels or colors, from any source, give the same fingerprint. Server
 *       code only (node:crypto).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { createHash } from "node:crypto";
import { type BucketEntry, bucketsOf, type PoolSlot, slotKey } from "@haruhimemoe/pool";
import { slotModsCode, slotModsMap } from "@/utils/slot-mods";

/** Slots, and the bucket list when it isn't the default. */
export type PoolShape = {
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[] | undefined;
};

/**
 * @function fingerprintText
 * @param pool {PoolShape} a pool
 * @returns {string} one "beatmapId:mods" line per slot, sorted
 */
export const fingerprintText = (pool: PoolShape): string => {
  const mods = slotModsMap(pool.slots, bucketsOf(pool));
  return pool.slots
    .map((slot) => `${slot.beatmapId}:${slotModsCode(slot, mods.get(slotKey(slot)))}`)
    .sort()
    .join("\n");
};

/**
 * @function poolFingerprint
 * @param pool {PoolShape} a pool
 * @returns {string} sha256 (lowercase hex) of fingerprintText
 */
export const poolFingerprint = (pool: PoolShape): string =>
  createHash("sha256").update(fingerprintText(pool), "utf8").digest("hex");
