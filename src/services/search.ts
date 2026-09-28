/**
 * @file src/services/search.ts
 * @desc Pool and map search: one page of results, the total, the "hidden, data missing" count,
 *       and (pools) whether any pool knows badged. The pools tab lists past tournament pools,
 *       pools built here (public and not hidden, with their owner's osu! name; none when badged
 *       or a star range is set, since built pools have neither), or both (built pools first,
 *       then past pools, each in the chosen order), each query built by src/utils/search-query.ts
 *       (hinted index, maxTimeMS). Counts use the count command (countMatching), never an
 *       aggregation. "Contains map" takes a beatmap ID or difficulty link; a set link or anything
 *       else comes back as a message for the person.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { BEATMAP_REF_MESSAGES, parseBeatmapRef } from "@haruhimemoe/pool";
import type { Collection, Document, Filter } from "mongodb";
import { POOL_INDEXES, QUERY_TIME_MS } from "@/constants/db";
import { MAX_SEARCH_PAGE, SEARCH_PAGE_SIZE } from "@/constants/search";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { mapsCollection } from "@/models/Map";
import { poolsCollection } from "@/models/Pool";
import { ownerNamesOf } from "@/services/built-pools";
import { countMatching } from "@/services/count";
import type {
  MapFilters,
  MapResult,
  PoolFilters,
  PoolResult,
  SearchResponse,
} from "@/utils/search-params";
import {
  type BuiltQuery,
  builtPoolQuery,
  builtSearchable,
  mapQuery,
  poolQuery,
} from "@/utils/search-query";

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

type PoolRows = { rows: PoolResult[]; total: number; hiddenMissing: number };

const NO_ROWS: PoolRows = { rows: [], total: 0, hiddenMissing: 0 };

/** Past pools from `skip`, at most `limit` of them, with the totals. */
const pastPools = async (
  filters: PoolFilters,
  mapId: number | null,
  skip: number,
  limit: number,
): Promise<PoolRows> => {
  const query = { ...poolQuery(filters, 1, mapId), skip, limit };
  const projection = { name: 1, tournament: 1, round: 1, year: 1, badged: 1, stats: 1 };
  const { rows, total, hiddenMissing } = await run(await poolsCollection(), query, projection);
  return {
    total,
    hiddenMissing,
    rows: rows.map(
      (row): PoolResult => ({
        kind: "past",
        builtBy: null,
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

type BuiltRow = {
  _id: string;
  name: string;
  tournament: string;
  round: string;
  year: number | null;
  ownerId: string;
  mapCount?: number;
  slots?: unknown[];
};

/** Public, unhidden built pools from `skip`, at most `limit`, with their owners' names. */
const builtPools = async (
  filters: PoolFilters,
  mapId: number | null,
  skip: number,
  limit: number,
): Promise<PoolRows> => {
  if (!builtSearchable(filters)) return NO_ROWS;
  const query = { ...builtPoolQuery(filters, 1, mapId), skip, limit };
  // Slots only for rows written before mapCount was stored.
  const projection = {
    name: 1,
    tournament: 1,
    round: 1,
    year: 1,
    ownerId: 1,
    mapCount: 1,
    "slots.beatmapId": 1,
  };
  const found = await run(await builtPoolsCollection(), query, projection);
  const rows = found.rows as unknown as BuiltRow[];
  const owners = await ownerNamesOf(rows.map((row) => row.ownerId));
  return {
    total: found.total,
    hiddenMissing: found.hiddenMissing,
    rows: rows.map(
      (row): PoolResult => ({
        kind: "built",
        builtBy: owners.get(row.ownerId) ?? null,
        id: row._id,
        name: row.name,
        tournament: row.tournament,
        round: row.round === "" ? null : row.round,
        year: row.year,
        badged: null,
        stats: {
          srMin: null,
          srMax: null,
          count: row.mapCount ?? row.slots?.length ?? 0,
          complete: false,
        },
      }),
    ),
  };
};

/** "Both": built pools first, then past pools, each in the chosen order. */
const bothPools = async (
  filters: PoolFilters,
  mapId: number | null,
  skip: number,
): Promise<PoolRows> => {
  const built = await builtPools(filters, mapId, skip, SEARCH_PAGE_SIZE);
  const past = await pastPools(
    filters,
    mapId,
    Math.max(0, skip - built.total),
    SEARCH_PAGE_SIZE - built.rows.length,
  );
  return {
    rows: [...built.rows, ...past.rows],
    total: built.total + past.total,
    hiddenMissing: built.hiddenMissing + past.hiddenMissing,
  };
};

/**
 * @function searchPools
 * @param filters {PoolFilters} the pool filters, with the type: past pools, built here, both
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
  const skip = (page - 1) * SEARCH_PAGE_SIZE;
  const pools = await poolsCollection();
  const [{ rows, total, hiddenMissing }, known] = await Promise.all([
    filters.type === "past"
      ? pastPools(filters, mapId, skip, SEARCH_PAGE_SIZE)
      : filters.type === "built"
        ? builtPools(filters, mapId, skip, SEARCH_PAGE_SIZE)
        : bothPools(filters, mapId, skip),
    filters.type === "built"
      ? null
      : pools.findOne(
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
    results: rows,
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
