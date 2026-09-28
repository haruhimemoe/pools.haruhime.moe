/**
 * @file src/utils/search-filters.ts
 * @desc Each search tab's filters and their empty values (nothing set), the search state
 *       (tab, page, the maps tab's scope, the filters), and whether a tab has any filter set.
 *       Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import type { PlayedAsCode } from "@/constants/pools";
import {
  type BadgedFilter,
  DEFAULT_MAP_SORT,
  DEFAULT_MAP_STATUS,
  DEFAULT_POOL_SORT,
  DEFAULT_POOL_TYPE,
  type MapSort,
  type MapStatus,
  type PoolSort,
  type PoolType,
} from "@/constants/search";

export type Range = readonly [number, number | null];

export type PoolFilters = {
  /** Past tournament pools, pools built here, or both. */
  type: PoolType;
  q: string;
  year: Range | null;
  badged: BadgedFilter;
  sr: Range | null;
  maps: Range | null;
  /** "Contains map": a beatmap ID or link as typed. */
  map: string;
  sort: PoolSort;
};

export type MapFilters = {
  q: string;
  sr: Range | null;
  len: Range | null;
  bpm: Range | null;
  ar: Range | null;
  od: Range | null;
  cs: Range | null;
  played: PlayedAsCode[];
  used: Range | null;
  last: Range | null;
  sort: MapSort;
};

export const EMPTY_POOL_FILTERS: PoolFilters = Object.freeze({
  type: DEFAULT_POOL_TYPE,
  q: "",
  year: null,
  badged: "any",
  sr: null,
  maps: null,
  map: "",
  sort: DEFAULT_POOL_SORT,
}) as PoolFilters;

export const EMPTY_MAP_FILTERS: MapFilters = Object.freeze({
  q: "",
  sr: null,
  len: null,
  bpm: null,
  ar: null,
  od: null,
  cs: null,
  played: [],
  used: null,
  last: null,
  sort: DEFAULT_MAP_SORT,
}) as MapFilters;

export type AllMapFilters = {
  q: string;
  status: MapStatus;
  sr: Range | null;
  len: Range | null;
  bpm: Range | null;
  /** Show explicit maps (the mirror hides them unless asked). */
  explicit: boolean;
};

export const EMPTY_ALL_MAP_FILTERS: AllMapFilters = Object.freeze({
  q: "",
  status: DEFAULT_MAP_STATUS,
  sr: null,
  len: null,
  bpm: null,
  explicit: false,
}) as AllMapFilters;

export type SearchState =
  | { tab: "pools"; page: number; filters: PoolFilters }
  | { tab: "maps"; scope: "played"; page: number; filters: MapFilters }
  | { tab: "maps"; scope: "all"; page: number; filters: AllMapFilters };

/**
 * @function hasPoolFilters
 * @param filters {PoolFilters} pool filters
 * @returns {boolean} whether any filter row is set (the type, text and sort aside)
 */
export const hasPoolFilters = (filters: PoolFilters): boolean =>
  filters.year !== null ||
  filters.badged !== "any" ||
  filters.sr !== null ||
  filters.maps !== null ||
  filters.map !== "";

/**
 * @function hasMapFilters
 * @param filters {MapFilters} map filters
 * @returns {boolean} whether any filter row is set (the text and sort aside)
 */
export const hasMapFilters = (filters: MapFilters): boolean =>
  [
    filters.sr,
    filters.len,
    filters.bpm,
    filters.ar,
    filters.od,
    filters.cs,
    filters.used,
    filters.last,
  ].some((value) => value !== null) || filters.played.length > 0;

/**
 * @function hasAllMapFilters
 * @param filters {AllMapFilters} all-maps filters
 * @returns {boolean} whether any filter row is set (the text aside; Ranked is the default)
 */
export const hasAllMapFilters = (filters: AllMapFilters): boolean =>
  filters.status !== DEFAULT_MAP_STATUS ||
  filters.explicit ||
  [filters.sr, filters.len, filters.bpm].some((value) => value !== null);
