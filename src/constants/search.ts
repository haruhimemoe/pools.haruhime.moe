/**
 * @file src/constants/search.ts
 * @desc Search limits and options: paging, caching, slider bounds, sorts and labels, the maps
 *       tab's scope (all osu! maps or maps played in pools), the pools tab's type (past
 *       tournament pools, built here, or both, and the note when Built here clears filters it
 *       can't use), the all-maps statuses, the mirror's
 *       search endpoint and its timeout, and the fixed copy the all-maps search shows. Shared by
 *       the page, the route and the queries.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { FIRST_YEAR } from "@/constants/pools";

/** A search query is cut to this many characters before it's folded and matched. */
export const MAX_QUERY_LENGTH = 100;

/** The search page's tabs. */
export const SEARCH_TABS = ["pools", "maps"] as const;
/** One of SEARCH_TABS. */
export type SearchTab = (typeof SEARCH_TABS)[number];

/** Results per search page. */
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

/** The star rating slider. */
export const STAR_RANGE: FilterBounds = Object.freeze({ min: 0, max: 10, step: 0.01, decimals: 2 });
/** The length slider, in seconds (600 and over is open). */
export const LENGTH_RANGE: FilterBounds = Object.freeze({ min: 0, max: 600, step: 1, decimals: 0 });
/** The BPM slider. */
export const BPM_RANGE: FilterBounds = Object.freeze({ min: 60, max: 300, step: 1, decimals: 0 });
/** The AR slider. */
export const AR_RANGE: FilterBounds = Object.freeze({ min: 0, max: 11, step: 0.1, decimals: 1 });
/** The OD slider. */
export const OD_RANGE: FilterBounds = Object.freeze({ min: 0, max: 11, step: 0.1, decimals: 1 });
/** The CS slider. */
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

/** The badged filter's choices. */
export const BADGED_FILTERS = ["any", "yes", "no", "unknown"] as const;
/** One of BADGED_FILTERS. */
export type BadgedFilter = (typeof BADGED_FILTERS)[number];
/** What each badged choice is called. */
export const BADGED_LABELS: Readonly<Record<BadgedFilter, string>> = Object.freeze({
  any: "Any",
  yes: "Badged",
  no: "Not badged",
  unknown: "Not known",
});

/** The pools tab lists past tournament pools (old links too), pools built here, or both. */
export const POOL_TYPES = ["past", "built", "both"] as const;
/** Which pools the pools tab lists: past, built here or both. */
export type PoolType = (typeof POOL_TYPES)[number];
/** Past pools: what a link without a type means. */
export const DEFAULT_POOL_TYPE: PoolType = "past";
/** What each pool type is called. */
export const POOL_TYPE_LABELS: Readonly<Record<PoolType, string>> = Object.freeze({
  past: "Past tournament pools",
  built: "Built here",
  both: "Both",
});

/** Said when picking "Built here" cleared the badged and star filters (built pools have neither). */
export const BUILT_CLEARED_NOTE =
  "Pools built here have no badged or star data, so those filters were cleared.";

/** The pools tab's orders. */
export const POOL_SORTS = ["year", "name", "maps"] as const;
/** One of POOL_SORTS. */
export type PoolSort = (typeof POOL_SORTS)[number];
/** Newest year first. */
export const DEFAULT_POOL_SORT: PoolSort = "year";
/** What each pool order is called. */
export const POOL_SORT_LABELS: Readonly<Record<PoolSort, string>> = Object.freeze({
  year: "Year, newest first",
  name: "Name, A to Z",
  maps: "Most maps",
});

/** The played-maps orders. */
export const MAP_SORTS = ["used", "last", "stars", "length", "title"] as const;
/** One of MAP_SORTS. */
export type MapSort = (typeof MAP_SORTS)[number];
/** Most used first. */
export const DEFAULT_MAP_SORT: MapSort = "used";
/** What each map order is called. */
export const MAP_SORT_LABELS: Readonly<Record<MapSort, string>> = Object.freeze({
  used: "Most used",
  last: "Last used",
  stars: "Star rating (no mod), high to low",
  length: "Length, longest first",
  title: "Title, A to Z",
});

/** The maps tab searches every osu! map (the mirror) or the maps played in pools (ours). */
export const MAP_SCOPES = ["all", "played"] as const;
/** Which maps the maps tab searches: all osu! maps or maps played in pools. */
export type MapScope = (typeof MAP_SCOPES)[number];
/** What each scope is called. */
export const MAP_SCOPE_LABELS: Readonly<Record<MapScope, string>> = Object.freeze({
  all: "All osu! maps",
  played: "Played in pools",
});

/**
 * All-maps status chips, one at a time (the mirror filters on one). Ranked includes approved.
 * No "Any": the mirror has no value for every status (status=any, or none, answers osu!'s
 * default of ranked and qualified), so an old status=any link reads as the default.
 */
export const MAP_STATUSES = ["ranked", "loved", "qualified", "pending", "graveyard"] as const;
/** An osu! status the all-maps search takes. */
export type MapStatus = (typeof MAP_STATUSES)[number];
/** Ranked maps first. */
export const DEFAULT_MAP_STATUS: MapStatus = "ranked";
/** What each status is called. */
export const MAP_STATUS_LABELS: Readonly<Record<MapStatus, string>> = Object.freeze({
  ranked: "Ranked",
  loved: "Loved",
  qualified: "Qualified",
  pending: "Pending",
  graveyard: "Graveyard",
});

/** How a beatmapset's osu! status reads on its card (anything else shows as osu! sent it). */
export const SET_STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  ranked: "Ranked",
  approved: "Approved",
  loved: "Loved",
  qualified: "Qualified",
  pending: "Pending",
  wip: "WIP",
  graveyard: "Graveyard",
});

/** The hinai mirror's search, called from our server only. */
export const MIRROR_SEARCH_URL = "https://mirror.hinamizawa.ai/v3/osu/beatmaps/search/v2";
/** How long an all-maps search call to the mirror may take. */
export const MIRROR_SEARCH_TIMEOUT_MS = 10_000;
/** The longest we skip the mirror's search after it answers 429 or 503 with Retry-After. */
export const MIRROR_COOLDOWN_MAX_MS = 60_000;
/** How long we skip the mirror after one of our calls to it timed out. */
export const MIRROR_TIMEOUT_COOLDOWN_MS = 30_000;
/** osu! reports at most this many results for a search the mirror passes on to it. */
export const MIRROR_TOTAL_CAP = 10_000;

/** Said (with a 503) when the all-maps search can't answer. */
export const ALL_MAPS_FAILED =
  "Searching all osu! maps isn't working right now. Maps played in pools still work.";
/** The code the route sends with ALL_MAPS_FAILED (a 503, never a 429 or a network error). */
export const MIRROR_UNAVAILABLE_CODE = "mirror_unavailable";
/** The live count when a search failed. */
export const SEARCH_FAILED_COUNT = "Couldn't search";
/** Said over results with unranked sets. */
export const UNRANKED_WARNING =
  "Unranked maps can change or disappear after you pool them. Check the map before your round.";

/**
 * @function hiddenSetsText
 * @param count {number} sets left out of this page
 * @returns {string} "12 hidden: not allowed in officially supported tournaments"
 */
export const hiddenSetsText = (count: number): string =>
  `${count} hidden: not allowed in officially supported tournaments`;
