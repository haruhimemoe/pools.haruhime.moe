/**
 * @file src/utils/built-summary.ts
 * @desc What a built pool's summary says, from its slots and map details: the star range of each
 *       bucket that has maps (each slot's stars under its mods when known, else no-mod), beatmapsets in more than one slot (a pool can't hold the
 *       same difficulty twice, but two difficulties of one set are worth a look), and the maps
 *       past pools played. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { type PoolSlot, slotLabel } from "@haruhimemoe/pool";
import type { BuiltMaps } from "@/schemas/built-pool-view";
import type { SlotGroup } from "@/utils/built-editor";
import { groupHeading } from "@/utils/built-editor";
import { mapLabel } from "@/utils/map-record";
import { groupSlotCode, type SlotValueMap, slotValueKey } from "@/utils/slot-values";

export type StarRange = {
  title: string;
  /** Lowest and highest stars (under each slot's mods when known), null when none are known. */
  low: number | null;
  high: number | null;
  /** Maps in the bucket, and how many of them have stars. */
  maps: number;
  known: number;
};

/**
 * @function starRanges
 * @param groups {readonly SlotGroup[]} the pool's slots by bucket
 * @param maps {BuiltMaps} map details
 * @param values {SlotValueMap} values under each slot's mods, as far as they're known
 * @returns {StarRange[]} one per bucket that has maps, in order
 */
export const starRanges = (
  groups: readonly SlotGroup[],
  maps: BuiltMaps,
  values: SlotValueMap = {},
): StarRange[] =>
  groups
    .filter((group) => group.slots.length > 0)
    .map((group) => {
      const stars = group.slots.flatMap((slot) => {
        const code = groupSlotCode(slot, group.entry);
        const value =
          values[slotValueKey(slot.beatmapId, code)]?.stars ?? maps[slot.beatmapId]?.stars;
        return value == null ? [] : [value];
      });
      return {
        title: groupHeading(group.entry).title,
        low: stars.length > 0 ? Math.min(...stars) : null,
        high: stars.length > 0 ? Math.max(...stars) : null,
        maps: group.slots.length,
        known: stars.length,
      };
    });

export type SetRepeat = { setId: number; name: string; slots: string[] };

/**
 * @function repeatedSets
 * @param slots {readonly PoolSlot[]} the pool's slots, in order
 * @param maps {BuiltMaps} map details
 * @returns {SetRepeat[]} each beatmapset in two or more slots, with its "Artist - Title" and
 *          those slots' labels
 */
export const repeatedSets = (slots: readonly PoolSlot[], maps: BuiltMaps): SetRepeat[] => {
  const bySet = new Map<number, SetRepeat>();
  for (const slot of slots) {
    const map = maps[slot.beatmapId];
    if (map?.setId == null) continue;
    const name = mapLabel({ artist: map.artist, title: map.title, version: null }, map.id);
    const entry = bySet.get(map.setId) ?? { setId: map.setId, name, slots: [] };
    entry.slots.push(slotLabel(slot));
    bySet.set(map.setId, entry);
  }
  return [...bySet.values()].filter((entry) => entry.slots.length > 1);
};

export type PlayedMap = {
  beatmapId: number;
  slot: string;
  label: string;
  count: number;
  lastYear: number | null;
};

/**
 * @function playedBefore
 * @param slots {readonly PoolSlot[]} the pool's slots, in order
 * @param maps {BuiltMaps} map details
 * @returns {PlayedMap[]} the slots whose map a past pool played, with how often and how lately
 */
export const playedBefore = (slots: readonly PoolSlot[], maps: BuiltMaps): PlayedMap[] =>
  slots.flatMap((slot) => {
    const map = maps[slot.beatmapId];
    if (!map || map.usage.count === 0) return [];
    const { count, lastYear } = map.usage;
    return [
      {
        beatmapId: slot.beatmapId,
        slot: slotLabel(slot),
        label: mapLabel(map, map.id),
        count,
        lastYear,
      },
    ];
  });
