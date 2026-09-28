/**
 * @file src/services/search.ts
 * @desc Pool and map search: one page of results, the total, the "hidden, data missing" count,
 *       and (pools) whether any pool knows badged. The pools tab lists past tournament pools,
 *       pools built here (public and not hidden, with their owner's osu! name; none when badged
 *       or a star range is set, since built pools have neither), or both (built pools first,
 *       then past pools, each in the chosen order), each query built by src/utils/search-query.ts
 *       (hinted index, maxTimeMS). Counts use the count command (countMatching), never an
 *       aggregation. "Contains map" takes a beatmap ID or difficulty link; a set link or anything
 *       else comes back as a message for the person. The pools tab's queries are
 *       src/services/search-pools.ts; this holds the maps tab and the shared query runner.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import type { Collection, Document, Filter } from "mongodb";
import { MAX_SEARCH_PAGE, SEARCH_PAGE_SIZE } from "@/constants/search";
import { mapsCollection } from "@/models/Map";
import type { MapResult, SearchResponse } from "@/schemas/search-response";
import { countMatching } from "@/services/count";
import type { MapFilters } from "@/utils/search-filters";
import { type BuiltQuery, mapQuery } from "@/utils/search-query";

type MapsAnswer = Omit<Extract<SearchResponse, { tab: "maps"; scope: "played" }>, "tab" | "scope">;

export const pageCountOf = (total: number): number =>
  Math.min(MAX_SEARCH_PAGE, Math.ceil(total / SEARCH_PAGE_SIZE));

/** One page, the total and the "hidden, data missing" count; counts use the count command. */

export const run = async <T extends Document>(
  collection: Collection<T>,
  query: BuiltQuery,
  projection: Document,
) => {
  const options = { hint: query.hint, maxTimeMS: query.maxTimeMS };
  const [rows, total, hiddenMissing] = await Promise.all([
    // A limit of 0 would mean no limit: a page "Both" already filled asks for counts only.
    query.limit === 0
      ? Promise.resolve([])
      : collection
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

/** Past pools from `skip`, at most `limit` of them, with the totals. */

/** Public, unhidden built pools from `skip`, at most `limit`, with their owners' names. */

/** "Both": built pools first, then past pools, each in the chosen order. */

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
