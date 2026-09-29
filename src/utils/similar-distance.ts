/**
 * @file src/utils/similar-distance.ts
 * @desc The "difficulty match" fallback: a weighted distance over the values pools can get
 *       cheaply under the mods (stars, BPM, length, AR, OD, CS; FALLBACK_WEIGHTS), a closeness
 *       0..100 from it, and the nearest maps from a list of candidates (never the map itself or
 *       its own set). An unknown AR, OD or CS on either side adds nothing. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { FALLBACK_WEIGHTS } from "@/constants/similar";

/** What the fallback compares: values under the mods (AR, OD and CS null when unknown). */
export type DifficultyPoint = {
  stars: number;
  bpm: number;
  /** Seconds. */
  length: number;
  ar: number | null;
  od: number | null;
  cs: number | null;
};

/** A candidate: its ids and its values. */
export type FallbackCandidate = { id: number; setId: number; point: DifficultyPoint };

const KEYS = Object.keys(FALLBACK_WEIGHTS) as (keyof typeof FALLBACK_WEIGHTS)[];

/**
 * @function difficultyDistance
 * @param a {DifficultyPoint} one map
 * @param b {DifficultyPoint} another
 * @returns {number} the weighted distance, 0 when every known value matches
 */
export const difficultyDistance = (a: DifficultyPoint, b: DifficultyPoint): number => {
  let sum = 0;
  for (const key of KEYS) {
    const left = a[key];
    const right = b[key];
    if (left === null || right === null) continue;
    const { weight, scale } = FALLBACK_WEIGHTS[key];
    sum += weight * ((left - right) / scale) ** 2;
  }
  return Math.sqrt(sum);
};

/**
 * @function closenessPercent
 * @param distance {number} a difficultyDistance
 * @returns {number} a whole percent: 100 at 0, falling as the distance grows
 */
export const closenessPercent = (distance: number): number => Math.round(100 / (1 + distance / 4));

/**
 * @function nearestByDifficulty
 * @param source {{ id: number; setId: number | null; point: DifficultyPoint }} the map
 * @param candidates {readonly FallbackCandidate[]} maps to rank
 * @param count {number} how many to keep
 * @returns {{ id: number; percent: number }[]} the closest first (ties by id), without the map
 *          itself, its set, or repeats
 */
export const nearestByDifficulty = (
  source: { id: number; setId: number | null; point: DifficultyPoint },
  candidates: readonly FallbackCandidate[],
  count: number,
): { id: number; percent: number }[] => {
  const seen = new Set<number>([source.id]);
  const ranked: { id: number; distance: number }[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.id) || candidate.setId === source.setId) continue;
    seen.add(candidate.id);
    ranked.push({ id: candidate.id, distance: difficultyDistance(source.point, candidate.point) });
  }
  ranked.sort((a, b) => a.distance - b.distance || a.id - b.id);
  return ranked
    .slice(0, count)
    .map(({ id, distance }) => ({ id, percent: closenessPercent(distance) }));
};
