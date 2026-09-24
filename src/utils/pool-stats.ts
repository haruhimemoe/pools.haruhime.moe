/**
 * @file src/utils/pool-stats.ts
 * @desc Pool stats from its maps: no-mod star, length and BPM ranges, count (slots, so a map in
 *       two slots counts twice), and complete only when every map has all three values. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { PoolStats } from "@/schemas/pool";

/** What stats read from a map. */
export type StatsMeta = { stars: number | null; length: number | null; bpm: number | null };

const range = (values: readonly number[]): [number | null, number | null] =>
  values.length === 0 ? [null, null] : [Math.min(...values), Math.max(...values)];

/**
 * @function emptyPoolStats
 * @param count {number} the pool's slot count
 * @returns {PoolStats} no ranges, incomplete
 */
export const emptyPoolStats = (count: number): PoolStats => ({
  srMin: null,
  srMax: null,
  lenMin: null,
  lenMax: null,
  bpmMin: null,
  bpmMax: null,
  count,
  complete: false,
});

/**
 * @function computePoolStats
 * @param slots {readonly { beatmapId: number }[]} the pool's slots
 * @param metaOf {(beatmapId: number) => StatsMeta | undefined} each map's values
 * @returns {PoolStats} ranges over the known values, the slot count, and whether every map had
 *          stars, length and BPM
 */
export const computePoolStats = (
  slots: readonly { beatmapId: number }[],
  metaOf: (beatmapId: number) => StatsMeta | undefined,
): PoolStats => {
  const stars: number[] = [];
  const lengths: number[] = [];
  const bpms: number[] = [];
  let complete = slots.length > 0;
  for (const { beatmapId } of slots) {
    const meta = metaOf(beatmapId);
    if (meta?.stars == null || meta.length == null || meta.bpm == null) complete = false;
    if (meta?.stars != null) stars.push(meta.stars);
    if (meta?.length != null) lengths.push(meta.length);
    if (meta?.bpm != null) bpms.push(meta.bpm);
  }
  const [srMin, srMax] = range(stars);
  const [lenMin, lenMax] = range(lengths);
  const [bpmMin, bpmMax] = range(bpms);
  return { srMin, srMax, lenMin, lenMax, bpmMin, bpmMax, count: slots.length, complete };
};

/**
 * @function samePoolStats
 * @param a {PoolStats} stats
 * @param b {PoolStats} other stats
 * @returns {boolean} whether every field matches
 */
export const samePoolStats = (a: PoolStats, b: PoolStats): boolean =>
  a.srMin === b.srMin &&
  a.srMax === b.srMax &&
  a.lenMin === b.lenMin &&
  a.lenMax === b.lenMax &&
  a.bpmMin === b.bpmMin &&
  a.bpmMax === b.bpmMax &&
  a.count === b.count &&
  a.complete === b.complete;
