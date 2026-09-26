/**
 * @file src/services/search.ts
 * @desc Pool and map search: one page of results, the total, the "hidden, data missing" count,
 *       and (pools) whether any pool knows badged, each query built by src/utils/search-query.ts
 *       (hinted index, maxTimeMS). Counts use the count command (countMatching), never an
 *       aggregation. "Contains map" takes a beatmap ID or difficulty link; a set link or anything
 *       else comes back as a message for the person.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

import "server-only";
import { BEATMAP_REF_MESSAGES, parseBeatmapRef } from "@haruhimemoe/pool";
import type { Collection, Document, Filter } from "mongodb";
import { POOL_INDEXES, QUERY_TIME_MS } from "@/constants/db";
import { MAX_SEARCH_PAGE, SEARCH_PAGE_SIZE } from "@/constants/search";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import { countMatching } from "@/services/count";
import type {
  MapFilters,
  MapResult,
  PoolFilters,
  PoolResult,
  SearchResponse,
} from "@/utils/search-params";
import { type BuiltQuery, mapQuery, poolQuery } from "@/utils/search-query";

type PoolsAnswer = Omit<Extract<SearchResponse, { tab: "pools" }>, "tab">;
type MapsAnswer = Omit<Extract<SearchResponse, { tab: "maps"; scope: "played" }>, "tab" | "scope">;

const pageCountOf = (total: number): number =>
  Math.min(MAX_SEARCH_PAGE, Math.ceil(total / SEARCH_PAGE_SIZE));

/** One page, the total and the "hidden, data missing" count; counts use the count command. */
const run = async <T extends Document>(
  collection: Collection<T>,
  query: BuiltQuery,
  projection: Document,
) => {
  const options = { hint: query.hint, maxTimeMS: query.maxTimeMS };
  const [rows, total, hiddenMissing] = await Promise.all([
    collection
      .find(query.filter as Filter<T>, {
        projection,
        sort: query.sort,
        skip: query.skip,
        limit: query.limit,
        ...options,
      })
      .toArray(),
    countMatching(collection, query.filter, options),
    query.missing ? countMatching(collection, query.missing, options) : Promise.resolve(0),
  ]);
  return { rows, total, hiddenMissing };
};

/**
 * @function searchPools
 * @param filters {PoolFilters} the pool filters
 * @param page {number} 1-based page
 * @returns {Promise<PoolsAnswer | { error: string }>} the page, or why "contains map" can't be read
 */
export const searchPools = async (
  filters: PoolFilters,
  page: number,
): Promise<PoolsAnswer | { error: string }> => {
  let mapId: number | null = null;
  if (filters.map !== "") {
    const ref = parseBeatmapRef(filters.map);
    if (!ref.ok) return { error: BEATMAP_REF_MESSAGES[ref.reason] };
    mapId = ref.beatmapId;
  }
  const pools = await poolsCollection();
  const query = poolQuery(filters, page, mapId);
  const [{ rows, total, hiddenMissing }, known] = await Promise.all([
    run(pools, query, { name: 1, tournament: 1, round: 1, year: 1, badged: 1, stats: 1 }),
    pools.findOne(
      { visible: true, badged: { $ne: null } },
      { projection: { _id: 1 }, hint: POOL_INDEXES.badged, maxTimeMS: QUERY_TIME_MS },
    ),
  ]);
  return {
    page,
    pageCount: pageCountOf(total),
    total,
    hiddenMissing,
    badgedKnown: known !== null,
    results: rows.map(
      (row): PoolResult => ({
        id: row._id,
        name: row.name,
        tournament: row.tournament,
        round: row.round,
        year: row.year,
        badged: row.badged,
        stats: {
          srMin: row.stats.srMin,
          srMax: row.stats.srMax,
          count: row.stats.count,
          complete: row.stats.complete,
        },
      }),
    ),
  };
};

/**
 * @function searchMaps
 * @param filters {MapFilters} the map filters
 * @param page {number} 1-based page
 * @returns {Promise<MapsAnswer>} the page
 */
export const searchMaps = async (filters: MapFilters, page: number): Promise<MapsAnswer> => {
  const maps = await mapsCollection();
  const { rows, total, hiddenMissing } = await run(maps, mapQuery(filters, page), {
    artist: 1,
    title: 1,
    version: 1,
    setHost: 1,
    stars: 1,
    length: 1,
    bpm: 1,
    usage: 1,
  });
  return {
    page,
    pageCount: pageCountOf(total),
    total,
    hiddenMissing,
    results: rows.map(
      (row): MapResult => ({
        id: row._id,
        artist: row.artist,
        title: row.title,
        version: row.version,
        setHost: row.setHost,
        stars: row.stars,
        length: row.length,
        bpm: row.bpm,
        usage: {
          count: row.usage.count,
          lastYear: row.usage.lastYear,
          playedAs: row.usage.playedAs,
        },
      }),
    ),
  };
};
