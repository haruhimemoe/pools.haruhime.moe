/**
 * @file tests/helpers/nekoha.ts
 * @desc Stand-ins for the mirror's mod data (msw): the nekoha-collab search (rows shaped like the
 *       live answer: one difficulty a row, `stars` under the lens, `difficulty_rating`, BPM and
 *       length without mods) and pp-maps/stats (available_mods), each recording the requests.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { HttpResponse, http } from "msw";
import { NEKOHA_SEARCH_URL, PP_MAPS_STATS_URL } from "@/constants/browse";

/**
 * @function nekohaRow
 * @param id {number} a beatmap id
 * @param setId {number} its set
 * @param extra {Record<string, unknown>} fields to change
 * @returns {Record<string, unknown>} a ranked row under DT: 6.2 stars (4.5 without mods), 180
 *          BPM and 120 s without mods
 */
export const nekohaRow = (
  id: number,
  setId: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  artist: "Camellia",
  beatmap_id: id,
  beatmap_md5: "0d218c67b5928e4ebe405dae986c9037",
  beatmapset_id: setId,
  bpm: 180,
  cover: `https://assets.ppy.sh/beatmaps/${setId}/covers/card.jpg`,
  creator: "Mapper",
  difficulty_rating: 4.5,
  max_combo: 1000,
  mod: "DT",
  mode: 0,
  pp: 300.25,
  stars: 6.2,
  status: "ranked",
  title: "Xeroa",
  total_length: 120,
  version: `Diff ${id}`,
  ...extra,
});

/**
 * @function nekohaAnswer
 * @param maps {unknown[]} the page's rows
 * @param extra {Record<string, unknown>} fields to change (mod, total, page, ready, success)
 * @returns {Response} a 200 answer (total = the rows given unless said)
 */
export const nekohaAnswer = (maps: unknown[], extra: Record<string, unknown> = {}): Response =>
  HttpResponse.json({
    limit: 50,
    maps,
    mod: "DT",
    page: 1,
    ready: true,
    success: true,
    total: maps.length,
    ...extra,
  });

export type MirrorCall = { url: URL; userAgent: string | null };

/**
 * @function nekohaHandler
 * @param answer {(url: URL) => Response} what the mirror says
 * @param calls {MirrorCall[]} filled with every request
 * @returns the msw handler for the search
 */
export const nekohaHandler = (answer: (url: URL) => Response, calls: MirrorCall[] = []) =>
  http.get(NEKOHA_SEARCH_URL, ({ request }) => {
    const url = new URL(request.url);
    calls.push({ url, userAgent: request.headers.get("user-agent") });
    return answer(url);
  });

/**
 * @function lensStatsHandler
 * @param answer {() => Response} what the mirror says
 * @param calls {MirrorCall[]} filled with every request
 * @returns the msw handler for pp-maps/stats
 */
export const lensStatsHandler = (answer: () => Response, calls: MirrorCall[] = []) =>
  http.get(PP_MAPS_STATS_URL, ({ request }) => {
    calls.push({ url: new URL(request.url), userAgent: request.headers.get("user-agent") });
    return answer();
  });

/**
 * @function lensStats
 * @param mods {string[]} available_mods
 * @returns {Response} a 200 stats answer
 */
export const lensStats = (mods: string[]): Response =>
  HttpResponse.json({ available_mods: mods, success: true, total_beatmaps: 224750 });
