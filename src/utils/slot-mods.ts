/**
 * @file src/utils/slot-mods.ts
 * @desc What each slot of a pool plays with: a built-in slot's code, a custom slot's forced mods,
 *       FM for a custom free mod slot, NM for a custom slot without mods and for a map without a
 *       slot. Shared by fingerprints (server) and map usage (also shown in the browser). Pure,
 *       and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import {
  type BucketEntry,
  isModBucket,
  modsLabel,
  NO_MODS,
  type PoolSlot,
  type SlotMods,
  slotKey,
  slotModsFor,
} from "@haruhimemoe/pool";

/**
 * @function slotModsMap
 * @param slots {readonly PoolSlot[]} the pool's slots
 * @param buckets {readonly BucketEntry[]} its bucket list
 * @returns {Map<string, SlotMods>} slotKey -> what that slot plays with (no slot: no mods)
 */
export const slotModsMap = (
  slots: readonly PoolSlot[],
  buckets: readonly BucketEntry[],
): Map<string, SlotMods> => {
  const byCode = new Map(buckets.map((entry) => [entry.code, slotModsFor(entry)]));
  return new Map(
    slots.map((slot) => [
      slotKey(slot),
      slot.mod === null ? NO_MODS : (byCode.get(slot.mod) ?? NO_MODS),
    ]),
  );
};

/**
 * @function slotModsCode
 * @param slot {PoolSlot} a slot
 * @param mods {SlotMods | undefined} what its bucket plays with (slotModsMap)
 * @returns {string} a built-in slot's code, a custom slot's forced mods ("HDHR"), FM for a
 *          custom free slot, NM for a custom slot without mods and for a map without a slot
 */
export const slotModsCode = (slot: PoolSlot, mods: SlotMods | undefined): string => {
  if (slot.mod !== null && isModBucket(slot.mod)) return slot.mod;
  if (mods?.kind === "forced") return modsLabel(mods.set);
  return mods?.kind === "free" ? "FM" : "NM";
};
