/**
 * @file tests/helpers/similar.ts
 * @desc Find similar's stand-ins: rows shaped like the mirror's live /api/v2/beatmaps answer (set
 *       status included), a handler answering the ids it knows and recording each call, and a
 *       similar_maps row written the way scripts/similar writes it (uint32 ids, uint8 scores).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { Binary } from "mongodb";
import { HttpResponse, http } from "msw";
import { MIRROR_BEATMAPS_URL } from "@/constants/similar";
import { similarMapsCollection } from "@/models/SimilarMaps";
import { encodeNeighbors, type Neighbor } from "@/utils/similar-binary";

/**
 * @function beatmapRow
 * @param id {number} a beatmap id
 * @param setId {number} its set
 * @param extra {Record<string, unknown>} fields to change (`beatmapset` merges)
 * @returns {Record<string, unknown>} a ranked osu!standard row: 5.5 stars, AR 9, OD 8, CS 4,
 *          180 BPM, 120 s
 */
export const beatmapRow = (
  id: number,
  setId: number,
  { beatmapset, ...extra }: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  beatmapset_id: setId,
  mode: "osu",
  version: `Diff ${id}`,
  difficulty_rating: 5.5,
  cs: 4,
  ar: 9,
  accuracy: 8,
  drain: 5,
  bpm: 180,
  total_length: 120,
  hit_length: 110,
  checksum: null,
  beatmapset: {
    artist: `Artist ${setId}`,
    title: `Song ${setId}`,
    creator: "Mapper",
    status: "ranked",
    ...(beatmapset as Record<string, unknown> | undefined),
  },
  ...extra,
});

/**
 * @function beatmapsHandler
 * @param rows {ReadonlyMap<number, Record<string, unknown>>} the rows the mirror knows
 * @param calls {number[][]} filled with every call's ids
 * @returns the msw handler for GET /api/v2/beatmaps?ids=
 */
export const beatmapsHandler = (
  rows: ReadonlyMap<number, Record<string, unknown>>,
  calls: number[][] = [],
) =>
  http.get(MIRROR_BEATMAPS_URL, ({ request }) => {
    const ids = (new URL(request.url).searchParams.get("ids") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number);
    calls.push(ids);
    return HttpResponse.json(ids.flatMap((id) => rows.get(id) ?? []));
  });

/**
 * @function rowsOf
 * @param rows {Record<string, unknown>[]} beatmap rows
 * @returns {Map<number, Record<string, unknown>>} them by id
 */
export const rowsOf = (rows: Record<string, unknown>[]): Map<number, Record<string, unknown>> =>
  new Map(rows.map((row) => [Number(row.id), row]));

/**
 * @function seedSimilar
 * @param id {number} the map
 * @param neighbors {readonly Neighbor[]} its neighbors and scores 0..255, best first
 * @param rev {string} the BoBERT revision
 * @returns {Promise<void>} once the row is in similar_maps
 */
export const seedSimilar = async (
  id: number,
  neighbors: readonly Neighbor[],
  rev = "v14.1",
): Promise<void> => {
  const { n, s } = encodeNeighbors(neighbors);
  await (await similarMapsCollection()).insertOne({
    _id: id,
    n: new Binary(n),
    s: new Binary(s),
    rev,
  });
};
