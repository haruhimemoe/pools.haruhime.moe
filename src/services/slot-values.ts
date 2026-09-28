/**
 * @file src/services/slot-values.ts
 * @desc Values under each pool slot's mods, for built and past pool pages: NM, HD, FM and TB
 *       slots keep the map's no-mod values (HD's rating included); other slots (HR, DT, EZ, HT,
 *       FL, forced custom combos) take stars, AR, OD and CS from the mirror's pp/batch under the
 *       combo (src/lib/mod-values.ts: one call per combo, cached 30 days) and BPM and length
 *       from the mod math. A map the mirror lacks keeps its no-mod rating with AR, OD, CS, BPM
 *       and length computed ("math": the page says "no mod data"). A failed mirror call still
 *       answers, marked incomplete so the page isn't cached as final.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import type { ModAcronym } from "@haruhimemoe/pool";
import { getModValues, type ModValuesDeps } from "@/lib/mod-values";
import type { ModValues } from "@/schemas/mod-values";
import {
  arUnderMods,
  bpmUnderMods,
  csUnderMods,
  lengthUnderMods,
  modsCode,
  odUnderMods,
  valueModsOf,
} from "@/utils/mod-values";

/** A map's values; null where pools doesn't know one. */
export type SlotMapValues = {
  stars: number | null;
  ar: number | null;
  od: number | null;
  cs: number | null;
  bpm: number | null;
  length: number | null;
};

/** A slot: its map, its mods (src/utils/slot-mods.ts slotModsCode) and the map's no-mod values. */
export type SlotValueRequest = { beatmapId: number; mods: string; noMod: SlotMapValues };

export type SlotValueAnswer = SlotMapValues & {
  /** The combo the values are under ("NM" for none). */
  mods: string;
  /** none: no-mod values; mirror: from pp/batch; math: no mod data, computed. */
  source: "none" | "mirror" | "math";
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** A value under the mods, or null when the no-mod one is unknown. */
const under = (
  value: number | null,
  mods: readonly ModAcronym[],
  math: (value: number, mods: readonly ModAcronym[]) => number,
): number | null => (value === null ? null : round2(math(value, mods)));

const answerFor = (
  { noMod }: SlotValueRequest,
  mods: readonly ModAcronym[],
  mirror: ModValues | undefined,
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
 * @function slotValues
 * @param slots {readonly SlotValueRequest[]} a pool's slots
 * @param deps {ModValuesDeps} fetch, timeout and clock (tests)
 * @returns {Promise<{ values: SlotValueAnswer[]; complete: boolean }>} each slot's values in
 *          order, and false when a mirror call failed
 */
export const slotValues = async (
  slots: readonly SlotValueRequest[],
  deps: ModValuesDeps = {},
): Promise<{ values: SlotValueAnswer[]; complete: boolean }> => {
  const modsOf = slots.map((slot) => valueModsOf(slot.mods));
  const idsByCode = new Map<string, number[]>();
  slots.forEach((slot, i) => {
    const mods = modsOf[i] ?? [];
    if (mods.length === 0) return;
    const code = modsCode(mods);
    idsByCode.set(code, [...(idsByCode.get(code) ?? []), slot.beatmapId]);
  });
  const found = new Map<string, Map<number, ModValues>>();
  let complete = true;
  for (const [code, ids] of idsByCode) {
    const result = await getModValues(ids, code, deps);
    found.set(code, result.values);
    if (result.failed) complete = false;
  }
  const values = slots.map((slot, i) => {
    const mods = modsOf[i] ?? [];
    return answerFor(slot, mods, found.get(modsCode(mods))?.get(slot.beatmapId));
  });
  return { values, complete };
};
