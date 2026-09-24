/**
 * @file src/services/maps.ts
 * @desc Map reads for pages: one map (missing unless some pool that isn't hidden has it), its
 *       history (one indexed lookup of current pools by beatmap id, the one query a public
 *       request runs over pools' slots), and the used maps for the sitemap and llms.txt (most
 *       used first; empty under SKIP_ENV_VALIDATION or on a database error).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { MAP_INDEXES, POOL_INDEXES, QUERY_TIME_MS } from "@/constants/db";
import { isEnvValidationSkipped } from "@/env";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import { parseStoredMap, type StoredMap } from "@/schemas/map";
import { type HistoryRow, historyRows } from "@/utils/history";
import type { LlmsMap } from "@/utils/llms-txt";

const MAX_BEATMAP_ID = 2_147_483_647;

/**
 * @function getPublicMap
 * @param id {number} an untrusted beatmap id
 * @returns {Promise<StoredMap | null>} the map when some pool that isn't hidden has it
 */
export const getPublicMap = async (id: number): Promise<StoredMap | null> => {
  if (!Number.isInteger(id) || id < 1 || id > MAX_BEATMAP_ID) return null;
  const maps = await mapsCollection();
  const map = parseStoredMap(await maps.findOne({ _id: id }, { maxTimeMS: QUERY_TIME_MS }));
  return map?.usage.shown ? map : null;
};

/**
 * @function getMapHistory
 * @param id {number} a beatmap id
 * @returns {Promise<HistoryRow[]>} every slot in a current pool that has the map, sorted
 */
export const getMapHistory = async (id: number): Promise<HistoryRow[]> => {
  const pools = await poolsCollection();
  const rows = await pools
    .find(
      { "slots.beatmapId": id, visible: true },
      {
        projection: { tournament: 1, round: 1, year: 1, badged: 1, sourceSlots: 1 },
        hint: POOL_INDEXES.beatmap,
        maxTimeMS: QUERY_TIME_MS,
      },
    )
    .toArray();
  return historyRows(id, rows);
};

/**
 * @function listListedMaps
 * @param limit {number} most maps to return (default: all)
 * @returns {Promise<LlmsMap[]>} maps some current pool uses, most used first
 */
export const listListedMaps = async (limit?: number): Promise<LlmsMap[]> => {
  if (isEnvValidationSkipped() || limit === 0) return [];
  try {
    const maps = await mapsCollection();
    return await maps
      .find(
        { "usage.count": { $gte: 1 } },
        {
          projection: { artist: 1, title: 1, version: 1, usage: 1 },
          sort: { "usage.count": -1, _id: 1 },
          hint: MAP_INDEXES.used,
          maxTimeMS: QUERY_TIME_MS,
          ...(limit === undefined ? {} : { limit }),
        },
      )
      .toArray();
  } catch (error) {
    console.error("maps: couldn't list used maps", error);
    return [];
  }
};
