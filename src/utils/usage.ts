/**
 * @file src/utils/usage.ts
 * @desc Map usage from pools: each map's count (distinct current pools that have it, a map twice
 *       in one pool once), lastYear (the highest known year among them), playedAs (every code
 *       its slots in them play as: a built-in slot's code, a custom slot's forced mod acronyms,
 *       FM for a custom free slot, NM for a custom slot without mods or a map without a slot, in
 *       chip order) and shown (some pool that isn't hidden has it, superseded ones included).
 *       Callers pass only pools that aren't hidden, each marked current or not. Also the
 *       "Used in N pools" line. Pure, and safe in the browser (no node:crypto).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import {
  type BucketEntry,
  bucketsOf,
  isModBucket,
  type PoolSlot,
  type SlotMods,
  slotKey,
} from "@haruhimemoe/pool";
import { PLAYED_AS_CODES, type PlayedAsCode } from "@/constants/pools";
import type { StoredMapUsage } from "@/schemas/map";
import { slotModsMap } from "@/utils/slot-mods";

/**
 * @function playedAsOf
 * @param slot {PoolSlot} a slot
 * @param mods {SlotMods | undefined} what its bucket plays with
 * @returns {PlayedAsCode[]} the codes that slot plays its map as
 */
export const playedAsOf = (slot: PoolSlot, mods: SlotMods | undefined): PlayedAsCode[] => {
  if (slot.mod !== null && isModBucket(slot.mod)) return [slot.mod];
  if (mods?.kind === "forced") return [...mods.set];
  if (mods?.kind === "free") return ["FM"];
  return ["NM"];
};

/** A pool that isn't hidden, as usage needs it. `current` is false once it's superseded. */
export type UsagePool = {
  id: string;
  year: number | null;
  current: boolean;
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[] | undefined;
};

/**
 * @function emptyMapUsage
 * @returns {StoredMapUsage} a map no pool that isn't hidden has
 */
export const emptyMapUsage = (): StoredMapUsage => ({
  count: 0,
  lastYear: null,
  playedAs: [],
  shown: false,
});

/**
 * @function buildUsage
 * @param pools {readonly UsagePool[]} every pool that isn't hidden (for the maps being rebuilt)
 * @returns {Map<number, StoredMapUsage>} beatmap id -> usage, for every map those pools have
 */
export const buildUsage = (pools: readonly UsagePool[]): Map<number, StoredMapUsage> => {
  type Tally = { pools: Set<string>; lastYear: number | null; codes: Set<PlayedAsCode> };
  const tallies = new Map<number, Tally>();
  for (const pool of pools) {
    const mods = slotModsMap(pool.slots, bucketsOf(pool));
    for (const slot of pool.slots) {
      let tally = tallies.get(slot.beatmapId);
      if (!tally) {
        tally = { pools: new Set(), lastYear: null, codes: new Set() };
        tallies.set(slot.beatmapId, tally);
      }
      if (!pool.current) continue;
      tally.pools.add(pool.id);
      if (pool.year !== null && (tally.lastYear === null || pool.year > tally.lastYear)) {
        tally.lastYear = pool.year;
      }
      for (const code of playedAsOf(slot, mods.get(slotKey(slot)))) tally.codes.add(code);
    }
  }
  return new Map(
    [...tallies].map(([id, tally]) => [
      id,
      {
        count: tally.pools.size,
        lastYear: tally.lastYear,
        playedAs: PLAYED_AS_CODES.filter((code) => tally.codes.has(code)),
        shown: true,
      },
    ]),
  );
};

/**
 * @function sameUsage
 * @param a {StoredMapUsage} usage
 * @param b {StoredMapUsage} other usage
 * @returns {boolean} whether every field matches (playedAs in order)
 */
export const sameUsage = (a: StoredMapUsage, b: StoredMapUsage): boolean =>
  a.count === b.count &&
  a.lastYear === b.lastYear &&
  a.shown === b.shown &&
  a.playedAs.length === b.playedAs.length &&
  a.playedAs.every((code, i) => code === b.playedAs[i]);

/**
 * @function usageSummary
 * @param usage {{ count: number; lastYear: number | null }} a map's usage
 * @returns {string} "Used in 3 pools (latest 2023)", "Used in 1 pool", or "Not in any current pool"
 */
export const usageSummary = ({
  count,
  lastYear,
}: {
  count: number;
  lastYear: number | null;
}): string => {
  if (count === 0) return "Not in any current pool";
  const used = `Used in ${count} ${count === 1 ? "pool" : "pools"}`;
  return lastYear === null ? used : `${used} (latest ${lastYear})`;
};
