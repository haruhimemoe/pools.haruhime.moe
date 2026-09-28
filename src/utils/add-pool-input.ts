/**
 * @file src/utils/add-pool-input.ts
 * @desc What an admin pastes as an added pool's maps, read the way packs reads a paste: a pack
 *       key anywhere in it (a packs /k link or a bare key; its slots and custom slot mods as
 *       they are), else slot lines ("NM1 129891", custom slots like HDHR1) and bare IDs or
 *       difficulty links through @haruhimemoe/pool's parser. A /p/<slug> link is refused: reading
 *       a pack by slug needs a packs API key. Also the added pool's name. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  decodePackKey,
  extractPackKey,
  MAX_NAME_LENGTH,
  MAX_SLOTS,
  PACK_KEY_ERROR_MESSAGES,
  PackKeyError,
  parsePoolText,
  slotLabel,
} from "@haruhimemoe/pool";
import type { PoolShape } from "@/utils/fingerprint";

/** A map as the admin listed it: its slot label and beatmap id. */
export type AddedSlot = { label: string; beatmapId: number };

/** The maps field read: a pool shape (a pack key's), labelled slots, or why not. */
export type AddPoolMaps =
  | { ok: true; from: "key"; slots: AddedSlot[]; shape: PoolShape }
  | { ok: true; from: "paste"; slots: AddedSlot[]; shape: null }
  | { ok: false; message: string };

/** Said when the maps field is empty. */
export const NO_MAPS =
  "Paste the maps: a packs link, a pack key, or beatmap IDs or links with their slots.";
/** Said for a pack's /p/ link, which names no maps. */
export const SLUG_LINK_REFUSED =
  "pools can't read a pack from its /p/ link. Paste the pack key or the pack's /k link instead.";

const PACK_PAGE_LINK = /packs\.haruhime\.moe\/p\/[\w-]+/iu;

/**
 * @function readAddPoolMaps
 * @param text {string} what the admin pasted
 * @returns {AddPoolMaps} the maps (labels in the paste's order; a key's shape too), or why they
 *          can't be read
 */
export const readAddPoolMaps = (text: string): AddPoolMaps => {
  const key = extractPackKey(text);
  if (key !== null) {
    try {
      const pool = decodePackKey(key);
      return {
        ok: true,
        from: "key",
        slots: pool.slots.map((slot) => ({ label: slotLabel(slot), beatmapId: slot.beatmapId })),
        shape: { slots: pool.slots, ...(pool.buckets ? { buckets: pool.buckets } : {}) },
      };
    } catch (error) {
      const message =
        error instanceof PackKeyError
          ? PACK_KEY_ERROR_MESSAGES[error.code]
          : "That pack key can't be read.";
      return { ok: false, message };
    }
  }
  if (PACK_PAGE_LINK.test(text)) return { ok: false, message: SLUG_LINK_REFUSED };
  const parsed = parsePoolText(text, { slots: [] });
  if (parsed.errors.length > 0) {
    const lines = parsed.errors.map((error) => `Line ${error.line}: ${error.reason}`);
    return { ok: false, message: lines.join(" ") };
  }
  if (parsed.slots.length === 0) return { ok: false, message: NO_MAPS };
  if (parsed.slots.length > MAX_SLOTS) {
    return {
      ok: false,
      message: `A pool holds at most ${MAX_SLOTS} maps; this has ${parsed.slots.length}.`,
    };
  }
  const slots = parsed.slots.map((slot) => ({
    label: slotLabel(slot),
    beatmapId: slot.beatmapId,
  }));
  return { ok: true, from: "paste", slots, shape: null };
};

/**
 * @function addedPoolName
 * @param fields {{ tournament: string; year: number | null; round: string | null }} what the
 *        admin typed
 * @returns {string} "<tournament> <year> <round>", parts left out when empty, spaces collapsed,
 *          cut at the last space at or before 64 characters (MAX_NAME_LENGTH), or at 64 when
 *          no space is in reach
 */
export const addedPoolName = ({
  tournament,
  year,
  round,
}: {
  tournament: string;
  year: number | null;
  round: string | null;
}): string => {
  const name = [tournament, year === null ? "" : String(year), round ?? ""]
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
  if (name.length <= MAX_NAME_LENGTH) return name;
  const space = name.lastIndexOf(" ", MAX_NAME_LENGTH);
  return (space > 0 ? name.slice(0, space) : name.slice(0, MAX_NAME_LENGTH)).trim();
};
