/**
 * @file src/services/similar-sets.ts
 * @desc Turns similar maps (already in order, each with its similarity) into what the map browser
 *       shows: values under the lens (the mirror's pp/batch; for NM the row's own; else no-mod
 *       values and the math, "math"), then the filters in order: the pool's maps (excluded),
 *       with `leaderboardOnly` maps with no leaderboard (unranked: not ranked, approved or loved),
 *       sets not allowed in officially supported tournaments (hidden; potential ones "Check
 *       first"), the star range under the lens (filtered); then how many past pools played
 *       each, and the sets grouped in order of their closest difficulty. A failed pp/batch,
 *       setFacts read or played-in lookup still answers, not to be cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { isLeaderboardStatus } from "@haruhimemoe/compliance";
import type { BrowseLens } from "@/constants/browse";
import { STAR_RANGE } from "@/constants/search";
import { getModValues, type ModValuesDeps } from "@/lib/mod-values";
import type { ModValues } from "@/schemas/mod-values";
import { countPlayed, judgeSets, type PlayedCounts } from "@/services/all-maps";
import { type DiffValues, diffValues, inRange } from "@/utils/browse-values";
import { parseMods } from "@/utils/mod-values";
import type { SimilarQuery, SimilarSet } from "@/utils/similar-params";

/** A similar map before the filters: its set, its no-mod values and its similarity. */
export type SimilarEntry = {
  id: number;
  setId: number;
  artist: string;
  title: string;
  creator: string;
  version: string;
  status: string;
  /** No-mod stars, BPM and length. */
  stars: number;
  bpm: number;
  length: number;
  /** No-mod AR, OD and CS, when known. */
  base: { ar: number; od: number; cs: number } | null;
  /** Stars under the lens, when the caller already has them (the fallback's rows). */
  starsUnderLens?: number;
  similarity: number;
};

/** The mirror's calls, the played lookup and the clock (tests). */
export type SimilarSetsDeps = ModValuesDeps & { playedCounts?: PlayedCounts };

/** The sets and the counts of what the filters left out. */
export type SimilarSets = {
  sets: SimilarSet[];
  hidden: number;
  excluded: number;
  unranked: number;
  filtered: number;
  cacheable: boolean;
};

/**
 * @function valuesUnderLens
 * @param entries {readonly SimilarEntry[]} the maps
 * @param lens {BrowseLens} the lens
 * @param deps {ModValuesDeps} the mirror call (tests)
 * @returns {Promise<{ values: Map<number, DiffValues & { stars: number }>; failed: boolean }>}
 *          each map's values under the lens, and whether pp/batch failed
 */
export const valuesUnderLens = async (
  entries: readonly SimilarEntry[],
  lens: BrowseLens,
  deps: ModValuesDeps = {},
): Promise<{ values: Map<number, DiffValues & { stars: number }>; failed: boolean }> => {
  const mods = parseMods(lens) ?? [];
  const noMod = lens === "NM";
  const asked = entries.filter((entry) => !(noMod && entry.base)).map((entry) => entry.id);
  const found = await getModValues(asked, lens, deps);
  const values = new Map<number, DiffValues & { stars: number }>();
  for (const entry of entries) {
    const own: ModValues | undefined =
      noMod && entry.base ? { ...entry.base, stars: entry.stars, bpm: entry.bpm } : undefined;
    const mirror = own ?? found.values.get(entry.id);
    const stars = mirror?.stars ?? entry.starsUnderLens ?? entry.stars;
    values.set(entry.id, { ...diffValues(entry, mods, mirror, entry.base), stars });
  }
  return { values, failed: found.failed };
};

const playedIn = async (ids: readonly number[], counts: PlayedCounts) => {
  try {
    return ids.length > 0 ? await counts(ids) : new Map<number, number>();
  } catch (error) {
    console.error("[similar] the played-in lookup failed", error);
    return null;
  }
};

/**
 * @function similarSets
 * @param entries {readonly SimilarEntry[]} similar maps, closest first
 * @param query {SimilarQuery} the lens, star range and status filter
 * @param excludeIds {ReadonlySet<number>} the pool's maps (empty: none)
 * @param deps {SimilarSetsDeps} the mirror calls, played lookup and clock (tests)
 * @returns {Promise<SimilarSets>} the sets, what was left out, and whether it may be cached
 */
export const similarSets = async (
  entries: readonly SimilarEntry[],
  query: SimilarQuery,
  excludeIds: ReadonlySet<number>,
  { playedCounts = countPlayed, ...deps }: SimilarSetsDeps = {},
): Promise<SimilarSets> => {
  const notInPool = entries.filter((entry) => !excludeIds.has(entry.id));
  const kept = query.leaderboardOnly
    ? notInPool.filter((entry) => isLeaderboardStatus(entry.status))
    : notInPool;
  const now = (deps.now ?? Date.now)();
  const judged = await judgeSets(
    [
      ...new Map(
        kept.map((e) => [
          e.setId,
          { id: e.setId, status: e.status, artist: e.artist, title: e.title },
        ]),
      ).values(),
    ],
    now,
  );
  const allowed = kept.filter((entry) => judged.allowed.has(entry.setId));
  const valued = await valuesUnderLens(allowed, query.lens, deps);
  const shown = allowed.filter((entry) =>
    inRange(valued.values.get(entry.id)?.stars ?? null, query.sr, STAR_RANGE),
  );
  const counts = await playedIn(
    shown.map((entry) => entry.id),
    playedCounts,
  );
  const bySet = new Map<number, SimilarSet>();
  for (const entry of shown) {
    const values = valued.values.get(entry.id);
    if (!values) continue;
    const set = bySet.get(entry.setId) ?? {
      setId: entry.setId,
      artist: entry.artist,
      title: entry.title,
      creator: entry.creator,
      status: entry.status,
      unranked: !isLeaderboardStatus(entry.status),
      check: judged.allowed.get(entry.setId)?.check ?? null,
      diffs: [],
    };
    set.diffs.push({
      ...values,
      id: entry.id,
      version: entry.version,
      starsNoMod: entry.stars,
      playedIn: counts === null ? null : (counts.get(entry.id) ?? 0),
      similarity: entry.similarity,
    });
    bySet.set(entry.setId, set);
  }
  return {
    sets: [...bySet.values()],
    excluded: entries.length - notInPool.length,
    unranked: notInPool.length - kept.length,
    hidden: kept.length - allowed.length,
    filtered: allowed.length - shown.length,
    cacheable: judged.ok && counts !== null && !valued.failed,
  };
};
