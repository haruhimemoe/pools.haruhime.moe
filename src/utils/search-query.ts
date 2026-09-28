/**
 * @file src/utils/search-query.ts
 * @desc Search filters to MongoDB queries. Every query starts with the public filter (visible
 *       pools; built pools that are public and not hidden; maps some current pool uses), hints the index behind its sort (so no public
 *       search sorts in memory or scans the collection), pages 50 at a time and runs under
 *       maxTimeMS. Text: every folded term must appear as an escaped substring of the stored
 *       search text. Ranges: inclusive, open at the slider edges; a pool's star range overlaps
 *       over complete stats only. When a range is set on a value some rows lack, `missing` is
 *       the query for "matched everything they had data for, but lacked it", the count the page
 *       shows as hidden. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Document } from "mongodb";
import { BUILT_POOL_INDEXES, MAP_INDEXES, POOL_INDEXES, QUERY_TIME_MS } from "@/constants/db";
import {
  AR_RANGE,
  BPM_RANGE,
  CS_RANGE,
  type FilterBounds,
  LENGTH_RANGE,
  MAP_COUNT_RANGE,
  type MapSort,
  OD_RANGE,
  type PoolSort,
  SEARCH_PAGE_SIZE,
  STAR_RANGE,
  USED_RANGE,
  YEAR_RANGE,
} from "@/constants/search";
import { escapeRegExp, searchTerms } from "@/utils/fold";
import type { MapFilters, PoolFilters, Range } from "@/utils/search-filters";

export type BuiltQuery = {
  filter: Document;
  /** Rows hidden only because a set range lacks their value; null when no such range is set. */
  missing: Document | null;
  sort: Record<string, 1 | -1>;
  hint: string;
  skip: number;
  limit: number;
  maxTimeMS: number;
};

type SortSpec = { sort: Record<string, 1 | -1>; hint: string };

export const POOL_SORT_SPECS: Readonly<Record<PoolSort, SortSpec>> = Object.freeze({
  year: { sort: { year: -1, _id: 1 }, hint: POOL_INDEXES.year },
  name: { sort: { sortName: 1, _id: 1 }, hint: POOL_INDEXES.name },
  maps: { sort: { "stats.count": -1, _id: 1 }, hint: POOL_INDEXES.maps },
});

export const MAP_SORT_SPECS: Readonly<Record<MapSort, SortSpec>> = Object.freeze({
  used: { sort: { "usage.count": -1, _id: 1 }, hint: MAP_INDEXES.used },
  last: { sort: { "usage.lastYear": -1, _id: 1 }, hint: MAP_INDEXES.last },
  stars: { sort: { stars: -1, _id: 1 }, hint: MAP_INDEXES.stars },
  length: { sort: { length: -1, _id: 1 }, hint: MAP_INDEXES.length },
  title: { sort: { sortTitle: 1, _id: 1 }, hint: MAP_INDEXES.title },
});

type RangeCondition = { match: Document; absent: Document | null };

/** { $gte, $lte } for a range; an end at the slider's edge adds no bound. */
const bounds = ([low, high]: Range, limits: FilterBounds): Document => ({
  ...(low > limits.min ? { $gte: low } : {}),
  ...(high !== null && high < limits.max ? { $lte: high } : {}),
});

const textConditions = (q: string): Document[] =>
  searchTerms(q).map((term) => ({ searchText: { $regex: escapeRegExp(term) } }));

const build = (
  base: Document[],
  ranges: RangeCondition[],
  spec: SortSpec,
  page: number,
): BuiltQuery => {
  const withAbsent = ranges.filter((range) => range.absent !== null);
  const missing =
    withAbsent.length === 0
      ? null
      : {
          $and: [
            ...base,
            ...ranges.map((range) =>
              range.absent === null ? range.match : { $or: [range.match, range.absent] },
            ),
            { $or: withAbsent.map((range) => range.absent) },
          ],
        };
  return {
    filter: { $and: [...base, ...ranges.map((range) => range.match)] },
    missing,
    sort: spec.sort,
    hint: spec.hint,
    skip: (page - 1) * SEARCH_PAGE_SIZE,
    limit: SEARCH_PAGE_SIZE,
    maxTimeMS: QUERY_TIME_MS,
  };
};

/**
 * @function poolQuery
 * @param filters {PoolFilters} the pool filters
 * @param page {number} 1-based page
 * @param mapId {number | null} "contains map", already read as a beatmap id
 * @returns {BuiltQuery} the query over visible pools
 */
export const poolQuery = (filters: PoolFilters, page: number, mapId: number | null): BuiltQuery => {
  const base: Document[] = [{ visible: true }, ...textConditions(filters.q)];
  if (filters.badged !== "any") {
    base.push({ badged: filters.badged === "yes" ? true : filters.badged === "no" ? false : null });
  }
  if (mapId !== null) base.push({ "slots.beatmapId": mapId });
  if (filters.maps) base.push({ "stats.count": bounds(filters.maps, MAP_COUNT_RANGE) });
  const ranges: RangeCondition[] = [];
  if (filters.year)
    ranges.push({ match: { year: bounds(filters.year, YEAR_RANGE) }, absent: { year: null } });
  if (filters.sr) {
    const [low, high] = filters.sr;
    ranges.push({
      match: {
        "stats.complete": true,
        ...(low > STAR_RANGE.min ? { "stats.srMax": { $gte: low } } : {}),
        ...(high !== null && high < STAR_RANGE.max ? { "stats.srMin": { $lte: high } } : {}),
      },
      absent: { "stats.complete": false },
    });
  }
  return build(base, ranges, POOL_SORT_SPECS[filters.sort], page);
};

export const BUILT_POOL_SORT_SPECS: Readonly<Record<PoolSort, SortSpec>> = Object.freeze({
  year: { sort: { year: -1, _id: 1 }, hint: BUILT_POOL_INDEXES.searchYear },
  name: { sort: { sortName: 1, _id: 1 }, hint: BUILT_POOL_INDEXES.searchName },
  maps: { sort: { mapCount: -1, _id: 1 }, hint: BUILT_POOL_INDEXES.searchMaps },
});

/**
 * @function builtSearchable
 * @param filters {PoolFilters} the pool filters
 * @returns {boolean} false when badged or a star range is set: built pools have neither, so
 *          none can match
 */
export const builtSearchable = (filters: PoolFilters): boolean =>
  filters.badged === "any" && filters.sr === null;

/**
 * @function builtPoolQuery
 * @param filters {PoolFilters} the pool filters (builtSearchable ones)
 * @param page {number} 1-based page
 * @param mapId {number | null} "contains map", already read as a beatmap id
 * @returns {BuiltQuery} the query over built pools that are public, not hidden and have maps:
 *          text, map, map count and year as for past pools
 */
export const builtPoolQuery = (
  filters: PoolFilters,
  page: number,
  mapId: number | null,
): BuiltQuery => {
  const base: Document[] = [
    { visibility: "public" },
    { hidden: false },
    // A pool made public before its first map has nothing to show yet.
    { "slots.0": { $exists: true } },
    ...textConditions(filters.q),
  ];
  if (mapId !== null) base.push({ "slots.beatmapId": mapId });
  if (filters.maps) base.push({ mapCount: bounds(filters.maps, MAP_COUNT_RANGE) });
  const ranges: RangeCondition[] = [];
  if (filters.year)
    ranges.push({ match: { year: bounds(filters.year, YEAR_RANGE) }, absent: { year: null } });
  return build(base, ranges, BUILT_POOL_SORT_SPECS[filters.sort], page);
};

/**
 * @function mapQuery
 * @param filters {MapFilters} the map filters
 * @param page {number} 1-based page
 * @returns {BuiltQuery} the query over maps some current pool uses
 */
export const mapQuery = (filters: MapFilters, page: number): BuiltQuery => {
  const base: Document[] = [{ "usage.count": { $gte: 1 } }, ...textConditions(filters.q)];
  if (filters.played.length > 0) base.push({ "usage.playedAs": { $all: filters.played } });
  if (filters.used) base.push({ "usage.count": bounds(filters.used, USED_RANGE) });
  const ranges: RangeCondition[] = [];
  const ranged = (field: string, range: Range | null, limits: FilterBounds) => {
    if (range)
      ranges.push({ match: { [field]: bounds(range, limits) }, absent: { [field]: null } });
  };
  ranged("stars", filters.sr, STAR_RANGE);
  ranged("length", filters.len, LENGTH_RANGE);
  ranged("bpm", filters.bpm, BPM_RANGE);
  ranged("ar", filters.ar, AR_RANGE);
  ranged("od", filters.od, OD_RANGE);
  ranged("cs", filters.cs, CS_RANGE);
  ranged("usage.lastYear", filters.last, YEAR_RANGE);
  return build(base, ranges, MAP_SORT_SPECS[filters.sort], page);
};
