/**
 * @file src/utils/slot-values.ts
 * @desc The pure side of values under a pool slot's mods (src/services/slot-values.ts asks the
 *       mirror): the combo each slot's values are under (none for NM, FM, TB, free and no-mod
 *       custom slots; else HD or the forced combo), for a built pool's slots and a past pool's
 *       source slots (matched to its slots by place, else by map, else none); a map's no-mod
 *       values; the answer for a slot from the mirror's values or, without them, the mod math
 *       with the no-mod rating ("math": no mod data); and what a slot says. Pure, and safe in
 *       the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { formatBpm, formatDuration, formatStat } from "@haruhimemoe/osu/format";
import {
  type BucketEntry,
  type ModAcronym,
  type PoolSlot,
  slotKey,
  slotModsFor,
} from "@haruhimemoe/pool";
import {
  arUnderMods,
  bpmUnderMods,
  csUnderMods,
  lengthUnderMods,
  modsCode,
  odUnderMods,
  valueModsOf,
} from "@/utils/mod-values";
import { starsText } from "@/utils/pool-text";
import { slotModsCode, slotModsMap } from "@/utils/slot-mods";

/** A map's values; null where pools doesn't know one. */
export type SlotMapValues = {
  stars: number | null;
  ar: number | null;
  od: number | null;
  cs: number | null;
  bpm: number | null;
  length: number | null;
};

export type SlotValueAnswer = SlotMapValues & {
  /** The combo the values are under ("NM" for none). */
  mods: string;
  /** none: no-mod values; mirror: from pp/batch; math: no mod data, computed. */
  source: "none" | "mirror" | "math";
};

/** Values by slotValueKey (beatmap id and combo). */
export type SlotValueMap = Readonly<Record<string, SlotValueAnswer>>;

/**
 * @function slotValueKey
 * @param beatmapId {number} a map
 * @param code {string} the combo its values are under
 * @returns {string} "<id>:<combo>"
 */
export const slotValueKey = (beatmapId: number, code: string): string => `${beatmapId}:${code}`;

/**
 * @function groupSlotCode
 * @param slot {PoolSlot} a slot
 * @param entry {BucketEntry | null | undefined} its bucket (none for a map without a slot)
 * @returns {string} the combo its values are under ("NM" for none)
 */
export const groupSlotCode = (slot: PoolSlot, entry: BucketEntry | null | undefined): string =>
  modsCode(valueModsOf(slotModsCode(slot, entry ? slotModsFor(entry) : undefined)));

/**
 * @function builtSlotCode
 * @param slot {PoolSlot} a slot
 * @param buckets {readonly BucketEntry[]} its pool's buckets
 * @returns {string} the combo its values are under ("NM" for none)
 */
export const builtSlotCode = (slot: PoolSlot, buckets: readonly BucketEntry[]): string =>
  groupSlotCode(
    slot,
    buckets.find((bucket) => bucket.code === slot.mod),
  );

/**
 * @function pastSlotCodes
 * @param pool {{ slots; buckets?; sourceSlots }} a past pool
 * @returns {string[]} for each source slot, the combo its values are under
 */
export const pastSlotCodes = (pool: {
  slots: readonly PoolSlot[];
  buckets?: readonly BucketEntry[] | undefined;
  sourceSlots: readonly { beatmapId: number }[];
}): string[] => {
  const mods = slotModsMap(pool.slots, pool.buckets ?? []);
  return pool.sourceSlots.map((source, i) => {
    const same = pool.slots[i];
    const slot =
      same?.beatmapId === source.beatmapId
        ? same
        : pool.slots.find((s) => s.beatmapId === source.beatmapId);
    if (!slot) return "NM";
    return modsCode(valueModsOf(slotModsCode(slot, mods.get(slotKey(slot)))));
  });
};

/**
 * @function noModOf
 * @param map {Partial<SlotMapValues> | null | undefined} a map's details
 * @returns {SlotMapValues} its no-mod values, null where unknown
 */
export const noModOf = (map: Partial<SlotMapValues> | null | undefined): SlotMapValues => ({
  stars: map?.stars ?? null,
  ar: map?.ar ?? null,
  od: map?.od ?? null,
  cs: map?.cs ?? null,
  bpm: map?.bpm ?? null,
  length: map?.length ?? null,
});

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** A value under the mods, or null when the no-mod one is unknown. */
const under = (
  value: number | null,
  mods: readonly ModAcronym[],
  math: (value: number, mods: readonly ModAcronym[]) => number,
): number | null => (value === null ? null : round2(math(value, mods)));

/**
 * @function slotAnswer
 * @param noMod {SlotMapValues} the map's no-mod values
 * @param mods {readonly ModAcronym[]} the combo the slot's values are under
 * @param mirror {{ stars: number; ar: number; od: number; cs: number } | undefined} the mirror's
 *        values under it, when it has them
 * @returns {SlotValueAnswer} no-mod values for no mods; else stars, AR, OD and CS from the
 *          mirror, or the no-mod rating and the math; BPM and length from the math
 */
export const slotAnswer = (
  noMod: SlotMapValues,
  mods: readonly ModAcronym[],
  mirror?: { stars: number; ar: number; od: number; cs: number },
): SlotValueAnswer => {
  const code = modsCode(mods);
  if (mods.length === 0) return { ...noMod, mods: code, source: "none" };
  const bpm = under(noMod.bpm, mods, bpmUnderMods);
  const length = noMod.length === null ? null : Math.round(lengthUnderMods(noMod.length, mods));
  if (mirror) {
    const { stars, ar, od, cs } = mirror;
    const values = { stars: round2(stars), ar: round2(ar), od: round2(od), cs: round2(cs) };
    return { ...values, bpm, length, mods: code, source: "mirror" };
  }
  return {
    stars: noMod.stars,
    ar: under(noMod.ar, mods, arUnderMods),
    od: under(noMod.od, mods, odUnderMods),
    cs: under(noMod.cs, mods, csUnderMods),
    bpm,
    length,
    mods: code,
    source: "math",
  };
};

/**
 * @function slotValuesText
 * @param values {SlotValueAnswer} a slot's values
 * @returns {{ stars: string; facts: string[]; note: string | null }} the stars with what they're
 *          under ("7.20★ DT", "5.50★ no mod"), the known AR, OD, length and BPM, and "no mod
 *          data" when the mirror had none
 */
export const slotValuesText = (values: SlotValueAnswer) => {
  const withMods = values.source === "mirror";
  const facts = [
    values.ar === null ? null : `AR ${formatStat(values.ar)}`,
    values.od === null ? null : `OD ${formatStat(values.od)}`,
    values.length === null ? null : formatDuration(values.length),
    values.bpm === null ? null : `${formatBpm(values.bpm)} BPM`,
  ].filter((part): part is string => part !== null);
  return {
    stars: `${starsText(values.stars)} ${withMods ? values.mods : "no mod"}`,
    facts,
    note: values.source === "math" ? "no mod data" : null,
  };
};
