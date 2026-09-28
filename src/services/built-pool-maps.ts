/**
 * @file src/services/built-pool-maps.ts
 * @desc Map details for built pools, and a built pool as its pages load it (the pool as the
 *       browser holds it, with its maps' details). Pages read the maps collection only. The editor asks for
 *       its pool's maps through GET /api/pools/<id>/maps, which first gives a map pools never saw
 *       a blank row and runs the mirror fill (src/services/map-fill.ts) on the ones still
 *       unfilled, as adding a pool does. Such rows count toward no pool: usage stays empty, so
 *       their /maps page doesn't exist.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { QUERY_TIME_MS } from "@/constants/db";
import { mapsCollection } from "@/models/Map";
import {
  type BuiltMap,
  type BuiltMaps,
  type ClientPool,
  clientPoolOf,
} from "@/schemas/built-pool-view";
import type { StoredMap } from "@/schemas/map";
import { getBuiltPoolFor } from "@/services/built-pool-read";
import { seedBlankMaps } from "@/services/import";
import { fillMaps, type MapLookup } from "@/services/map-fill";
import type { Caller } from "@/utils/built-access";

type MapRow = Pick<
  StoredMap,
  | "_id"
  | "setId"
  | "artist"
  | "title"
  | "version"
  | "setHost"
  | "stars"
  | "length"
  | "bpm"
  | "ar"
  | "od"
  | "cs"
> & { usage: Pick<StoredMap["usage"], "count" | "lastYear"> };

const builtMapOf = (row: MapRow): BuiltMap => ({
  id: row._id,
  setId: row.setId,
  artist: row.artist,
  title: row.title,
  version: row.version,
  setHost: row.setHost,
  stars: row.stars,
  length: row.length,
  bpm: row.bpm,
  ar: row.ar,
  od: row.od,
  cs: row.cs,
  usage: { count: row.usage.count, lastYear: row.usage.lastYear },
});

/**
 * @function getBuiltMaps
 * @param ids {readonly number[]} a pool's beatmap ids
 * @returns {Promise<BuiltMap[]>} the ones the maps collection has (no mirror call)
 */
export const getBuiltMaps = async (ids: readonly number[]): Promise<BuiltMap[]> => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const rows = await (await mapsCollection())
    .find(
      { _id: { $in: unique } },
      {
        projection: {
          setId: 1,
          artist: 1,
          title: 1,
          version: 1,
          setHost: 1,
          stars: 1,
          length: 1,
          bpm: 1,
          ar: 1,
          od: 1,
          cs: 1,
          "usage.count": 1,
          "usage.lastYear": 1,
        },
        maxTimeMS: QUERY_TIME_MS,
      },
    )
    .toArray();
  return rows.map((row) => builtMapOf(row as MapRow));
};

export type FillDeps = { lookup?: MapLookup; now?: () => Date };

/**
 * @function fillBuiltMaps
 * @param ids {readonly number[]} a pool's beatmap ids
 * @param deps {FillDeps} the mirror lookup and clock (tests)
 * @returns {Promise<{ maps: BuiltMap[]; error: string | null }>} every map's details after the
 *          fill, and why the mirror stopped early (the maps keep what they had)
 */
export const fillBuiltMaps = async (
  ids: readonly number[],
  { lookup, now = () => new Date() }: FillDeps = {},
): Promise<{ maps: BuiltMap[]; error: string | null }> => {
  if (ids.length === 0) return { maps: [], error: null };
  await seedBlankMaps(ids, now());
  const fill = await fillMaps({ ids, now, ...(lookup ? { lookup } : {}) });
  return { maps: await getBuiltMaps(ids), error: fill.error };
};

/**
 * @function loadBuiltPoolFor
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} who's asking
 * @returns {Promise<{ pool: ClientPool; maps: BuiltMaps } | null>} the pool as the browser holds
 *          it and its maps' details (the maps collection only), or null when it isn't there or
 *          isn't theirs to see
 */
export const loadBuiltPoolFor = async (
  id: string,
  caller: Caller,
): Promise<{ pool: ClientPool; maps: BuiltMaps } | null> => {
  const answer = await getBuiltPoolFor(id, caller);
  if (!answer.ok) return null;
  const pool = clientPoolOf(answer.value);
  const maps = await getBuiltMaps(pool.slots.map((slot) => slot.beatmapId));
  return { pool, maps: Object.fromEntries(maps.map((map) => [map.id, map])) };
};
