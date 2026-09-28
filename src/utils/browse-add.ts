/**
 * @file src/utils/browse-add.ts
 * @desc Where the map browser's Add puts a map, and which lens a bucket's "Find maps" opens it
 *       with. A bucket's lens is what it plays with: NM, HD, HR and DT as themselves, FM, TB and
 *       free or no-mod custom slots as NM, a custom slot's forced mods as their combo (NM when
 *       the mirror doesn't offer it). Find maps opens on page 1 with that lens, on Ranked when
 *       it was Qualified or Pending (they have no mod data), and with the bucket's target star
 *       range as the star filter when it has one. Add's default is the bucket
 *       the browser was opened for while the lens still matches it or is the lens Find maps set
 *       (so FM's Find maps adds to FM, and a custom HDFL slot's to HDFL), else the NM, HD, HR or
 *       DT slot for those lenses, else the custom slot forced to exactly the lens's mods, else
 *       none, and the page asks. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { type BucketEntry, isCustomBucket, slotModsFor } from "@haruhimemoe/pool";
import { type BrowseLens, DEFAULT_LENS } from "@/constants/browse";
import { STAR_RANGE } from "@/constants/search";
import type { TargetRange } from "@/schemas/built-plan";
import { type BrowseState, isLensStatus } from "@/utils/browse-state";
import { modsCode, parseMods } from "@/utils/mod-values";
import { normalizeRange } from "@/utils/search-ranges";

/** Lenses whose maps go straight to the built-in slot of the same name. */
const DIRECT: readonly string[] = ["NM", "HD", "HR", "DT"];

/**
 * @function bucketLens
 * @param entry {BucketEntry} a bucket
 * @returns {string} the combo it plays with, as a lens code ("NM" for no forced mods)
 */
export const bucketLens = (entry: BucketEntry): string => {
  const mods = slotModsFor(entry);
  if (mods.kind !== "forced") return DEFAULT_LENS;
  return modsCode(parseMods(mods.set.join("")) ?? []);
};

/**
 * @function lensForBucket
 * @param entry {BucketEntry} the bucket whose Find maps was pressed
 * @param lenses {readonly string[]} the lenses on offer
 * @returns {BrowseLens} its lens when offered, else NM
 */
export const lensForBucket = (entry: BucketEntry, lenses: readonly string[]): BrowseLens => {
  const lens = bucketLens(entry);
  return lenses.includes(lens) ? (lens as BrowseLens) : DEFAULT_LENS;
};

/**
 * @function findMapsState
 * @param state {BrowseState} the browser's state now
 * @param entry {BucketEntry} the bucket whose Find maps was pressed
 * @param lenses {readonly string[]} the lenses on offer
 * @param sr {TargetRange | undefined} the bucket's target star range, if it has one
 * @returns {BrowseState} its lens on page 1, on Ranked instead of Qualified or Pending, with the
 *          target's range as the star filter (the filter stays as it was without one)
 */
export const findMapsState = (
  state: BrowseState,
  entry: BucketEntry,
  lenses: readonly string[],
  sr?: TargetRange,
): BrowseState => ({
  ...state,
  lens: lensForBucket(entry, lenses),
  status: isLensStatus(state.status) ? state.status : "ranked",
  ...(sr ? { sr: normalizeRange([sr.min, sr.max], STAR_RANGE) } : {}),
  page: 1,
});

/** The bucket Find maps opened the browser for, and the lens it set. */
export type OpenedFor = { bucket: string; lens: string };

/**
 * @function defaultBucketFor
 * @param lens {string} the lens the results are under
 * @param buckets {readonly BucketEntry[]} the pool's buckets
 * @param openedFor {OpenedFor | null} the bucket Find maps opened the browser for, if any
 * @returns {string | null} the bucket Add uses, or null when none matches (the page asks)
 */
export const defaultBucketFor = (
  lens: string,
  buckets: readonly BucketEntry[],
  openedFor: OpenedFor | null,
): string | null => {
  const opened = buckets.find((entry) => entry.code === openedFor?.bucket);
  if (opened && (bucketLens(opened) === lens || openedFor?.lens === lens)) return opened.code;
  if (DIRECT.includes(lens)) return buckets.some((entry) => entry.code === lens) ? lens : null;
  const custom = buckets.find((entry) => isCustomBucket(entry) && bucketLens(entry) === lens);
  return custom?.code ?? null;
};
