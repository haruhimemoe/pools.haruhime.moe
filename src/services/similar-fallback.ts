/**
 * @file src/services/similar-fallback.ts
 * @desc "Difficulty match", for maps BoBERT's table doesn't have: the map's values under the lens,
 *       then one page of ranked maps from the mirror's mod data within FALLBACK_STAR_SPREAD stars
 *       of it (inside the star range, when one is set), ranked by the weighted distance over
 *       stars, BPM, length, AR, OD and CS under the lens (src/utils/similar-distance.ts). The
 *       mirror doesn't send aim or speed strain or slider factor, so stars stand in for them.
 *       Only osu!standard maps have a fallback; a failed mirror search is a failure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { type BrowseLens, DEFAULT_BROWSE_SORT } from "@/constants/browse";
import { FALLBACK_STAR_SPREAD, SIMILAR_COUNT } from "@/constants/similar";
import type { BeatmapRow } from "@/lib/beatmap-rows";
import type { ModValuesDeps } from "@/lib/mod-values";
import { type NekohaRow, searchNekoha } from "@/lib/nekoha-search";
import { type SimilarEntry, valuesUnderLens } from "@/services/similar-sets";
import type { Range } from "@/utils/search-filters";
import { type DifficultyPoint, nearestByDifficulty } from "@/utils/similar-distance";

/** The mirror's calls and the clock (tests). */
export type FallbackDeps = ModValuesDeps & { timeoutMs?: number };

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * @function entryOfRow
 * @param row {BeatmapRow} a difficulty from the mirror's lookup
 * @param similarity {number} how close it is, 0..100
 * @returns {SimilarEntry} the entry similarSets takes
 */
export const entryOfRow = (row: BeatmapRow, similarity: number): SimilarEntry => {
  const { id, setId, artist, title, creator, version, status, stars, bpm, length } = row;
  const base = { ar: row.ar, od: row.od, cs: row.cs };
  return {
    id,
    setId,
    artist,
    title,
    creator,
    version,
    status,
    stars,
    bpm,
    length,
    base,
    similarity,
  };
};

const entryOfNekoha = (row: NekohaRow, similarity: number): SimilarEntry => {
  const { id, setId, artist, title, creator, version, status, starsNoMod, bpm, length } = row;
  return {
    ...{ id, setId, artist, title, creator, version, status, bpm, length },
    stars: starsNoMod,
    starsUnderLens: row.stars,
    base: null,
    similarity,
  };
};

/** The star window: the map's stars give or take the spread, narrowed to the range when they meet. */
const windowOf = (stars: number, sr: Range | null): Range => {
  const low = Math.max(0, stars - FALLBACK_STAR_SPREAD);
  const high = stars + FALLBACK_STAR_SPREAD;
  const narrowLow = sr ? Math.max(low, sr[0]) : low;
  const narrowHigh = sr && sr[1] !== null ? Math.min(high, sr[1]) : high;
  return narrowLow <= narrowHigh
    ? [round2(narrowLow), round2(narrowHigh)]
    : [round2(low), round2(high)];
};

/**
 * @function difficultyMatches
 * @param source {BeatmapRow} the map (from the mirror's lookup)
 * @param lens {BrowseLens} the lens the mirror offers
 * @param sr {Range | null} the star range under it
 * @param deps {FallbackDeps} the mirror's calls (tests)
 * @returns {Promise<{ ok: true; entries: SimilarEntry[] } | { ok: false }>} up to SIMILAR_COUNT
 *          closest maps, closest first; none for a map that isn't osu!standard; a failure when
 *          the mirror's search failed
 */
export const difficultyMatches = async (
  source: BeatmapRow,
  lens: BrowseLens,
  sr: Range | null,
  deps: FallbackDeps = {},
): Promise<{ ok: true; entries: SimilarEntry[] } | { ok: false }> => {
  if (source.mode !== "osu") return { ok: true, entries: [] };
  const own = entryOfRow(source, 100);
  const sourceValues = (await valuesUnderLens([own], lens, deps)).values.get(source.id);
  if (!sourceValues) return { ok: true, entries: [] };
  const found = await searchNekoha(
    {
      lens,
      status: "ranked",
      q: "",
      sr: windowOf(sourceValues.stars, sr),
      sort: DEFAULT_BROWSE_SORT,
      page: 1,
    },
    deps,
  );
  if (!found.ok) {
    console.error(`[similar] the fallback's mod data search failed: ${found.reason}`);
    return { ok: false };
  }
  const rows = found.rows.filter((row) => row.id !== source.id && row.setId !== source.setId);
  const entries = rows.map((row) => entryOfNekoha(row, 0));
  const valued = await valuesUnderLens(entries, lens, deps);
  const pointOf = (id: number): DifficultyPoint | null => valued.values.get(id) ?? null;
  const ranked = nearestByDifficulty(
    { id: source.id, setId: source.setId, point: sourceValues },
    entries.flatMap((entry) => {
      const point = pointOf(entry.id);
      return point ? [{ id: entry.id, setId: entry.setId, point }] : [];
    }),
    SIMILAR_COUNT,
  );
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return {
    ok: true,
    entries: ranked.flatMap(({ id, percent }) => {
      const entry = byId.get(id);
      return entry ? [{ ...entry, similarity: percent }] : [];
    }),
  };
};
