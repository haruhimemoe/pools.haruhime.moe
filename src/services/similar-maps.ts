/**
 * @file src/services/similar-maps.ts
 * @desc Find similar (GET /api/maps/<id>/similar). Reads the map's one similar_maps row
 *       (BoBERT's nearest maps, "pattern match"), loads those maps and the map itself in one
 *       call to the mirror's lookup (src/lib/beatmap-rows.ts) and runs them through
 *       src/services/similar-sets.ts (values under the lens, the pool's maps, compliance, the
 *       star range, played-in). A map with no row (the table is empty until the first import,
 *       and new, graveyard and other modes' maps are never in it) gets the "difficulty match"
 *       fallback (src/services/similar-fallback.ts). A lens the mirror doesn't offer reads as NM.
 *       The pool's maps are left out only for its owner and editors; anyone else's pool id is
 *       ignored. With `leaderboardOnly` the row's leaderboard list (nl, sl: the top 20 among
 *       ranked, approved and loved maps) is read instead, falling back to filtering n, s on rows
 *       that lack it; either way only maps the mirror calls ranked, approved or loved are kept,
 *       and the answer counts the rest (unranked) out of the total. The fallback only finds
 *       ranked maps.
 *       A failed similar_maps read falls back and isn't cached; a failed mirror lookup
 *       or search is a failure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { DEFAULT_LENS } from "@/constants/browse";
import { QUERY_TIME_MS } from "@/constants/db";
import { type BeatmapRow, getBeatmapRows } from "@/lib/beatmap-rows";
import { availableLenses } from "@/lib/browse-lenses";
import { similarMapsCollection } from "@/models/SimilarMaps";
import { loadFor } from "@/services/built-pool-read";
import { difficultyMatches, entryOfRow, type FallbackDeps } from "@/services/similar-fallback";
import { type SimilarSetsDeps, similarSets } from "@/services/similar-sets";
import type { Caller } from "@/utils/built-access";
import { decodeNeighbors, type Neighbor, scorePercent } from "@/utils/similar-binary";
import type { SimilarQuery, SimilarResponse, SimilarSource } from "@/utils/similar-params";

/** Every call the answer makes (tests). */
export type SimilarDeps = SimilarSetsDeps & FallbackDeps;

/** The answer and whether it may be cached, or a failure. */
export type SimilarResult =
  | { ok: true; answer: SimilarResponse; cacheable: boolean }
  | { ok: false };

/**
 * The map's neighbors and BoBERT's revision; null with no row, "failed" when the read failed.
 * With `leaderboardOnly` the row's leaderboard list (nl, sl) when it has one; a row imported
 * before that list existed gives its n, s, and similarSets filters them.
 */
const readNeighbors = async (
  id: number,
  leaderboardOnly: boolean,
): Promise<{ neighbors: Neighbor[]; rev: string } | null | "failed"> => {
  try {
    const row = await (await similarMapsCollection()).findOne(
      { _id: id },
      { maxTimeMS: QUERY_TIME_MS },
    );
    if (!row) return null;
    const [n, s] = leaderboardOnly && row.nl && row.sl ? [row.nl, row.sl] : [row.n, row.s];
    const neighbors = decodeNeighbors(n.value(), s.value());
    return neighbors.length > 0 ? { neighbors, rev: String(row.rev) } : null;
  } catch (error) {
    console.error("[similar] the similar_maps read failed", error);
    return "failed";
  }
};

/** Every beatmap id in the pool (picks and candidates), when the caller can edit it. */
const poolIds = async (pool: string | null, caller: Caller): Promise<Set<number>> => {
  if (!pool || !caller) return new Set();
  const loaded = await loadFor(pool, caller, (access) => access.canEdit);
  if (!loaded.ok) return new Set();
  const { slots, candidates } = loaded.value.pool;
  const kept = Object.values(candidates ?? {}).flat();
  return new Set([...slots, ...kept].map((entry) => entry.beatmapId));
};

const sourceOf = (row: BeatmapRow | undefined): SimilarSource | null =>
  row ? { setId: row.setId, artist: row.artist, title: row.title, version: row.version } : null;

/**
 * @function findSimilarMaps
 * @param id {number} the map
 * @param query {SimilarQuery} the lens, star range and pool
 * @param caller {Caller} who's asking (the pool's maps are left out only for its editors)
 * @param deps {SimilarDeps} the mirror calls, played lookup and clock (tests)
 * @returns {Promise<SimilarResult>} the similar maps, how they were found and what was left out,
 *          and whether it may be cached; a failure when the mirror failed
 */
export const findSimilarMaps = async (
  id: number,
  query: SimilarQuery,
  caller: Caller,
  deps: SimilarDeps = {},
): Promise<SimilarResult> => {
  const lenses = await availableLenses(deps);
  const lens = lenses.includes(query.lens) ? query.lens : DEFAULT_LENS;
  const asked = { ...query, lens };
  const [stored, exclude] = await Promise.all([
    readNeighbors(id, query.leaderboardOnly),
    poolIds(query.pool, caller),
  ]);
  const pattern = stored !== null && stored !== "failed" ? stored : null;
  const ids = [id, ...(pattern?.neighbors.map((neighbor) => neighbor.id) ?? [])];
  const rows = await getBeatmapRows(ids, deps);
  if (!rows.ok) {
    console.error(`[similar] the mirror's lookup failed: ${rows.reason}`);
    return { ok: false };
  }
  const source = rows.rows.get(id);
  let entries: ReturnType<typeof entryOfRow>[] = [];
  let missing = 0;
  if (pattern) {
    for (const neighbor of pattern.neighbors) {
      const row = rows.rows.get(neighbor.id);
      if (row && row.mode === "osu") entries.push(entryOfRow(row, scorePercent(neighbor.score)));
      else missing++;
    }
  } else if (source) {
    const matched = await difficultyMatches(source, lens, query.sr, deps);
    if (!matched.ok) return { ok: false };
    entries = matched.entries;
  }
  const built = await similarSets(entries, asked, exclude, deps);
  const { sets, hidden, excluded, unranked, filtered } = built;
  return {
    ok: true,
    cacheable: built.cacheable && stored !== "failed" && query.pool === null,
    answer: {
      id,
      source: sourceOf(source),
      method: pattern ? "pattern" : "difficulty",
      rev: pattern?.rev ?? null,
      lens,
      ...{ hidden, excluded, unranked, filtered, missing, sets },
      total: entries.length,
    },
  };
};
