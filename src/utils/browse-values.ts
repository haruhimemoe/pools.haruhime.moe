/**
 * @file src/utils/browse-values.ts
 * @desc A map browser row's values under the lens, and the filters applied to a page once it
 *       arrives. BPM and length always come from the row's no-mod values and the mod math (the
 *       mirror's rows aren't adjusted); AR, OD and CS come from the mirror's pp/batch when it
 *       has the map ("mirror"), else from no-mod values and the math ("math": the page says
 *       "no mod data"), else they're unknown. AR, OD, CS and BPM are rounded to 2 decimals,
 *       length to whole seconds. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { ModAcronym } from "@haruhimemoe/pool";
import { AR_RANGE, BPM_RANGE, type FilterBounds, LENGTH_RANGE, OD_RANGE } from "@/constants/search";
import type { ModValues } from "@/schemas/mod-values";
import type { BrowseParams } from "@/utils/browse-params";
import {
  arUnderMods,
  bpmUnderMods,
  csUnderMods,
  lengthUnderMods,
  odUnderMods,
} from "@/utils/mod-values";
import type { Range } from "@/utils/search-params";

/** AR, OD and CS without mods. */
export type BaseValues = { ar: number; od: number; cs: number };

export type DiffValues = {
  ar: number | null;
  od: number | null;
  cs: number | null;
  bpm: number;
  length: number;
  /** "mirror": AR, OD and CS from the mirror under the lens; "math": computed, or unknown. */
  source: "mirror" | "math";
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * @function diffValues
 * @param row {{ bpm: number; length: number }} the row's no-mod BPM and length
 * @param mods {readonly ModAcronym[]} the lens
 * @param mirror {ModValues | undefined} the mirror's values under the lens, when it has them
 * @param base {BaseValues | null} no-mod AR, OD and CS, when known
 * @returns {DiffValues} the values under the lens, rounded, and where AR, OD and CS came from
 */
export const diffValues = (
  row: { bpm: number; length: number },
  mods: readonly ModAcronym[],
  mirror: ModValues | undefined,
  base: BaseValues | null,
): DiffValues => {
  const bpm = round2(bpmUnderMods(row.bpm, mods));
  const length = Math.round(lengthUnderMods(row.length, mods));
  if (mirror) {
    const { ar, od, cs } = mirror;
    return { ar: round2(ar), od: round2(od), cs: round2(cs), bpm, length, source: "mirror" };
  }
  if (!base) return { ar: null, od: null, cs: null, bpm, length, source: "math" };
  return {
    ar: round2(arUnderMods(base.ar, mods)),
    od: round2(odUnderMods(base.od, mods)),
    cs: round2(csUnderMods(base.cs, mods)),
    bpm,
    length,
    source: "math",
  };
};

/**
 * @function inRange
 * @param value {number | null} a value (null: unknown)
 * @param range {Range | null} a filter
 * @param bounds {FilterBounds} its slider: a bottom end at the minimum is no lower limit
 * @returns {boolean} true with no filter; false for an unknown value against one
 */
export const inRange = (
  value: number | null,
  range: Range | null,
  bounds: FilterBounds,
): boolean => {
  if (!range) return true;
  if (value === null) return false;
  const [low, high] = range;
  return (low <= bounds.min || value >= low) && (high === null || value <= high);
};

/**
 * @function passesPageFilters
 * @param values {Pick<DiffValues, "ar" | "od" | "bpm" | "length">} values under the lens
 * @param params {BrowseParams} the browse
 * @returns {boolean} whether the BPM, length, AR and OD filters pass it
 */
export const passesPageFilters = (
  values: Pick<DiffValues, "ar" | "od" | "bpm" | "length">,
  params: BrowseParams,
): boolean =>
  inRange(values.bpm, params.bpm, BPM_RANGE) &&
  inRange(values.length, params.len, LENGTH_RANGE) &&
  inRange(values.ar, params.ar, AR_RANGE) &&
  inRange(values.od, params.od, OD_RANGE);
