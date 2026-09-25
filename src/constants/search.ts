/**
 * @file src/constants/search.ts
 * @desc Search limits and options: paging, caching, slider bounds, sorts and labels, shared by
 *       the page, the route and the queries.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { FIRST_YEAR } from "@/constants/pools";

/** A search query is cut to this many characters before it's folded and matched. */
export const MAX_QUERY_LENGTH = 100;

export const SEARCH_TABS = ["pools", "maps"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export const SEARCH_PAGE_SIZE = 50;
/** A page number past this reads as this. */
export const MAX_SEARCH_PAGE = 200;
/** A "contains map" reference is cut to this many characters. */
export const MAX_MAP_REF_LENGTH = 200;

/**
 * Successful answers: the CDN keeps them 5 minutes and never serves them stale, so a pool an
 * admin hides leaves search within 5 minutes (nothing can purge the CDN's copies).
 */
export const SEARCH_CACHE = "public, s-maxage=300";

/** Quiet time after the last change before the URL is written. */
export const URL_WRITE_MS = 300;
/** Quiet time after the last change before results are fetched. */
export const FETCH_DELAY_MS = 250;

/**
 * A range slider's bounds. A bottom end at `min` means no lower limit and a top end at `max`
 * means no upper limit. `decimals` is how precisely a range is kept (and written in the URL).
 */
export type FilterBounds = {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly decimals: number;
};

export const STAR_RANGE: FilterBounds = Object.freeze({ min: 0, max: 10, step: 0.01, decimals: 2 });
export const LENGTH_RANGE: FilterBounds = Object.freeze({ min: 0, max: 600, step: 1, decimals: 0 });
export const BPM_RANGE: FilterBounds = Object.freeze({ min: 60, max: 300, step: 1, decimals: 0 });
export const AR_RANGE: FilterBounds = Object.freeze({ min: 0, max: 11, step: 0.1, decimals: 1 });
export const OD_RANGE: FilterBounds = Object.freeze({ min: 0, max: 11, step: 0.1, decimals: 1 });
export const CS_RANGE: FilterBounds = Object.freeze({ min: 0, max: 10, step: 0.1, decimals: 1 });
/** Times a map was used: 1 to 20+. */
export const USED_RANGE: FilterBounds = Object.freeze({ min: 1, max: 20, step: 1, decimals: 0 });
/** Maps in a pool: 1 to 40+. */
export const MAP_COUNT_RANGE: FilterBounds = Object.freeze({
  min: 1,
  max: 40,
  step: 1,
  decimals: 0,
});
/** Years: osu!'s first to this one (the top end is open). The admin form shares FIRST_YEAR. */
export const YEAR_RANGE: FilterBounds = Object.freeze({
  min: FIRST_YEAR,
  max: new Date().getUTCFullYear(),
  step: 1,
  decimals: 0,
});

export const BADGED_FILTERS = ["any", "yes", "no", "unknown"] as const;
export type BadgedFilter = (typeof BADGED_FILTERS)[number];
export const BADGED_LABELS: Readonly<Record<BadgedFilter, string>> = Object.freeze({
  any: "Any",
  yes: "Badged",
  no: "Not badged",
  unknown: "Not known",
});

export const POOL_SORTS = ["year", "name", "maps"] as const;
export type PoolSort = (typeof POOL_SORTS)[number];
export const DEFAULT_POOL_SORT: PoolSort = "year";
export const POOL_SORT_LABELS: Readonly<Record<PoolSort, string>> = Object.freeze({
  year: "Year, newest first",
  name: "Name, A to Z",
  maps: "Most maps",
});

export const MAP_SORTS = ["used", "last", "stars", "length", "title"] as const;
export type MapSort = (typeof MAP_SORTS)[number];
export const DEFAULT_MAP_SORT: MapSort = "used";
export const MAP_SORT_LABELS: Readonly<Record<MapSort, string>> = Object.freeze({
  used: "Most used",
  last: "Last used",
  stars: "Star rating (no mod), high to low",
  length: "Length, longest first",
  title: "Title, A to Z",
});
