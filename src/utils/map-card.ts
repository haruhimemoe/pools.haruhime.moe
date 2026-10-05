/**
 * @file src/utils/map-card.ts
 * @desc pools' records onto @haruhimemoe/ui's MapCard: a BuiltMap as MapData (setId, setHost,
 *       stars and length under BeatmapMeta's names), and a slot's facts under its mods as
 *       MapCard's stars, starsNote and stats (HP is never shown; "no mod data" for math values).
 *       Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import type { MapData } from "@haruhimemoe/ui";
import type { BuiltMap } from "@/schemas/built-pool-view";
import type { SlotValueAnswer } from "@/utils/slot-values";

/** A slot's facts for MapCard. */
export type SlotFacts = {
  stars: number | null;
  starsNote: string;
  stats: {
    cs: number | null;
    ar: number | null;
    od: number | null;
    hp: null;
    bpm: number | null;
    lengthSeconds: number | null;
  };
  note: string | null;
};

/**
 * @function toMapData
 * @param map {BuiltMap | null | undefined} a map pools knows
 * @returns {MapData | null} the same map under MapCard's field names, or null
 */
export const toMapData = (map: BuiltMap | null | undefined): MapData | null =>
  map
    ? {
        beatmapsetId: map.setId,
        artist: map.artist,
        title: map.title,
        version: map.version,
        creator: map.setHost,
        starRating: map.stars,
        cs: map.cs,
        ar: map.ar,
        od: map.od,
        bpm: map.bpm,
        lengthSeconds: map.length,
      }
    : null;

/**
 * @function slotFacts
 * @param values {SlotValueAnswer | undefined} the slot's values under its mods, once known
 * @param map {BuiltMap | null | undefined} the map, for the no-mod values until then
 * @returns {SlotFacts} stars, what they're under, the stats and the "no mod data" note
 */
export const slotFacts = (
  values: SlotValueAnswer | undefined,
  map: BuiltMap | null | undefined,
): SlotFacts =>
  values
    ? {
        stars: values.stars,
        starsNote: values.source === "mirror" ? values.mods : "no mod",
        stats: {
          cs: values.cs,
          ar: values.ar,
          od: values.od,
          hp: null,
          bpm: values.bpm,
          lengthSeconds: values.length,
        },
        note: values.source === "math" ? "no mod data" : null,
      }
    : {
        stars: map?.stars ?? null,
        starsNote: "no mod",
        stats: {
          cs: null,
          ar: null,
          od: null,
          hp: null,
          bpm: map?.bpm ?? null,
          lengthSeconds: map?.length ?? null,
        },
        note: null,
      };
