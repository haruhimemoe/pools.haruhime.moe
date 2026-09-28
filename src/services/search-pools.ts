/**
 * @file src/services/search-pools.ts
 * @desc The pools tab of GET /api/search: past pools, pools built here (public, not hidden, with
 *       maps, on their own indexes; badged and star filters leave them out) or both (built first,
 *       then past, paging across the two), each query hinted, time-limited and paged 50 at a
 *       time, counted with the count command.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { BEATMAP_REF_MESSAGES, parseBeatmapRef } from "@haruhimemoe/pool";
import { POOL_INDEXES, QUERY_TIME_MS } from "@/constants/db";
import { SEARCH_PAGE_SIZE } from "@/constants/search";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { poolsCollection } from "@/models/Pool";
import type { PoolResult, SearchResponse } from "@/schemas/search-response";
import { ownerNamesOf } from "@/services/built-pool-read";
import { pageCountOf, run } from "@/services/search";
import { builtSearchFieldsOf } from "@/utils/built-record";
import type { PoolFilters } from "@/utils/search-filters";
import { builtPoolQuery, builtSearchable, poolQuery } from "@/utils/search-query";

type PoolsAnswer = Omit<Extract<SearchResponse, { tab: "pools" }>, "tab">;

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
  // Slots only for rows written before mapCount was stored (builtSearchFieldsOf counts them).
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
          count: builtSearchFieldsOf(row).mapCount,
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
