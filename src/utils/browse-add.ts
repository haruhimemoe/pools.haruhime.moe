/**
 * @file src/utils/browse-add.ts
 * @desc Where the map browser's Add puts a map, and which lens a bucket's "Find maps" opens it
 *       with. A bucket's lens is what it plays with: NM, HD, HR and DT as themselves, FM, TB and
 *       free or no-mod custom slots as NM, a custom slot's forced mods as their combo. Add's
 *       default is the bucket the browser was opened for while the lens still matches it (so
 *       FM's Find maps adds to FM), else the NM, HD, HR or DT slot for those lenses, else the
 *       custom slot forced to exactly the lens's mods, else none, and the page asks. Pure, and
 *       safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { type BucketEntry, isCustomBucket, slotModsFor } from "@haruhimemoe/pool";
import { type BrowseLens, DEFAULT_LENS } from "@/constants/browse";
import { modsCode, parseMods } from "@/utils/mod-values";

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
 * @function defaultBucketFor
 * @param lens {string} the lens the results are under
 * @param buckets {readonly BucketEntry[]} the pool's buckets
 * @param openedFor {string | null} the bucket Find maps opened the browser for, if any
 * @returns {string | null} the bucket Add uses, or null when none matches (the page asks)
 */
export const defaultBucketFor = (
  lens: string,
  buckets: readonly BucketEntry[],
  openedFor: string | null,
): string | null => {
  const opened = buckets.find((entry) => entry.code === openedFor);
  if (opened && bucketLens(opened) === lens) return opened.code;
  if (DIRECT.includes(lens)) return buckets.some((entry) => entry.code === lens) ? lens : null;
  const custom = buckets.find((entry) => isCustomBucket(entry) && bucketLens(entry) === lens);
  return custom?.code ?? null;
};
