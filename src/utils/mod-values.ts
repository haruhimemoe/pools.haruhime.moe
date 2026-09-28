/**
 * @file src/utils/mod-values.ts
 * @desc A difficulty's values under mods, computed with osu!'s rules: BPM x1.5 with DT (NC reads
 *       as DT) and x0.75 with HT, length the other way; HR multiplies AR and OD by 1.4 and CS by
 *       1.3 (each capped at 10), EZ halves them; DT and HT change AR and OD through time, so AR
 *       goes to its preempt in ms and OD to its 300 hit window in ms, the clock rate divides
 *       those, and they come back as AR and OD. HR and EZ apply first, then the timing. Mod
 *       combos use @haruhimemoe/pool's codes. The fallback when the mirror has no mod values.
 *       Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import {
  isModAcronym,
  MOD_ACRONYMS,
  type ModAcronym,
  modSetProblem,
  modsLabel,
} from "@haruhimemoe/pool";

/** The values mods change. */
export type ModdableValues = { ar: number; od: number; cs: number; bpm: number; length: number };

/** The most mods one combo can hold (all six). */
const MAX_MODS = MOD_ACRONYMS.length;

/**
 * @function parseMods
 * @param text {string} a combo as typed: "NM" or "" for none, else two-letter codes in any order
 *        and case ("hdnc"); NC reads as DT
 * @returns {ModAcronym[] | null} the mods in canonical order (EZ, HD, HR, DT, HT, FL), or null
 *          for an unknown code, a mod twice, or a pair osu! won't combine (EZ with HR, DT with HT)
 */
export const parseMods = (text: string): ModAcronym[] | null => {
  const upper = text.trim().toUpperCase();
  if (upper === "" || upper === "NM") return [];
  if (!/^(?:[A-Z]{2})+$/.test(upper) || upper.length > MAX_MODS * 2) return null;
  const codes = (upper.match(/../g) ?? []).map((code) => (code === "NC" ? "DT" : code));
  if (!codes.every(isModAcronym) || new Set(codes).size !== codes.length) return null;
  const mods = MOD_ACRONYMS.filter((mod) => codes.includes(mod));
  const problem = modSetProblem(mods);
  return problem === null || problem === "tooMany" ? mods : null;
};

/**
 * @function modsCode
 * @param mods {readonly ModAcronym[]} mods in canonical order
 * @returns {string} "NM" for none, else the codes joined ("HDHRDT"), as the mirror names combos
 */
export const modsCode = (mods: readonly ModAcronym[]): string =>
  mods.length === 0 ? "NM" : modsLabel(mods);

/**
 * @function clockRate
 * @param mods {readonly ModAcronym[]} mods
 * @returns {number} 1.5 with DT, 0.75 with HT, else 1
 */
export const clockRate = (mods: readonly ModAcronym[]): number => {
  if (mods.includes("DT")) return 1.5;
  return mods.includes("HT") ? 0.75 : 1;
};

/**
 * @function arToPreempt
 * @param ar {number} an approach rate
 * @returns {number} ms a circle shows before its hit: 1800 at AR0, 1200 at AR5, 450 at AR10
 */
export const arToPreempt = (ar: number): number =>
  ar < 5 ? 1200 + (600 * (5 - ar)) / 5 : 1200 - (750 * (ar - 5)) / 5;

/**
 * @function preemptToAr
 * @param ms {number} a preempt in ms
 * @returns {number} the approach rate that shows circles that early (arToPreempt reversed)
 */
export const preemptToAr = (ms: number): number =>
  ms > 1200 ? 5 - ((ms - 1200) * 5) / 600 : 5 + ((1200 - ms) * 5) / 750;

/**
 * @function odToHitWindow
 * @param od {number} an overall difficulty
 * @returns {number} the 300 hit window in ms: 80 - 6 x OD
 */
export const odToHitWindow = (od: number): number => 80 - 6 * od;

/**
 * @function hitWindowToOd
 * @param ms {number} a 300 hit window in ms
 * @returns {number} the overall difficulty with that window (odToHitWindow reversed)
 */
export const hitWindowToOd = (ms: number): number => (80 - ms) / 6;

/** HR and EZ scale AR, OD and CS (HR caps each at 10). */
const scaled = (value: number, mods: readonly ModAcronym[], hardRock: number): number => {
  if (mods.includes("HR")) return Math.min(value * hardRock, 10);
  return mods.includes("EZ") ? value * 0.5 : value;
};

/**
 * @function arUnderMods
 * @param ar {number} the no-mod approach rate
 * @param mods {readonly ModAcronym[]} mods
 * @returns {number} HR or EZ first, then DT or HT through the preempt (can pass 10, or 0)
 */
export const arUnderMods = (ar: number, mods: readonly ModAcronym[]): number => {
  const base = scaled(ar, mods, 1.4);
  const rate = clockRate(mods);
  return rate === 1 ? base : preemptToAr(arToPreempt(base) / rate);
};

/**
 * @function odUnderMods
 * @param od {number} the no-mod overall difficulty
 * @param mods {readonly ModAcronym[]} mods
 * @returns {number} HR or EZ first, then DT or HT through the 300 hit window
 */
export const odUnderMods = (od: number, mods: readonly ModAcronym[]): number => {
  const base = scaled(od, mods, 1.4);
  const rate = clockRate(mods);
  return rate === 1 ? base : hitWindowToOd(odToHitWindow(base) / rate);
};

/**
 * @function csUnderMods
 * @param cs {number} the no-mod circle size
 * @param mods {readonly ModAcronym[]} mods
 * @returns {number} x1.3 with HR (at most 10), halved with EZ; the clock rate doesn't touch it
 */
export const csUnderMods = (cs: number, mods: readonly ModAcronym[]): number =>
  scaled(cs, mods, 1.3);

/**
 * @function bpmUnderMods
 * @param bpm {number} the no-mod BPM
 * @param mods {readonly ModAcronym[]} mods
 * @returns {number} times the clock rate
 */
export const bpmUnderMods = (bpm: number, mods: readonly ModAcronym[]): number =>
  bpm * clockRate(mods);

/**
 * @function lengthUnderMods
 * @param seconds {number} the no-mod length
 * @param mods {readonly ModAcronym[]} mods
 * @returns {number} divided by the clock rate (not rounded)
 */
export const lengthUnderMods = (seconds: number, mods: readonly ModAcronym[]): number =>
  seconds / clockRate(mods);

/**
 * @function valuesUnderMods
 * @param values {ModdableValues} no-mod values
 * @param mods {readonly ModAcronym[]} mods
 * @returns {ModdableValues} every value under the mods (not rounded)
 */
export const valuesUnderMods = (
  values: ModdableValues,
  mods: readonly ModAcronym[],
): ModdableValues => ({
  ar: arUnderMods(values.ar, mods),
  od: odUnderMods(values.od, mods),
  cs: csUnderMods(values.cs, mods),
  bpm: bpmUnderMods(values.bpm, mods),
  length: lengthUnderMods(values.length, mods),
});

/**
 * @function valueModsOf
 * @param code {string} a pool slot's mods (src/utils/slot-mods.ts): a built-in bucket code or a
 *        custom slot's forced combo
 * @returns {ModAcronym[]} the mods its values are shown under: none for NM, FM and TB, else the
 *          slot's mods (HD included: the mirror rates HD on its own)
 */
export const valueModsOf = (code: string): ModAcronym[] => parseMods(code) ?? [];
