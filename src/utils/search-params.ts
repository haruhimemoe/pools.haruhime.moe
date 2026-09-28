/**
 * @file src/utils/search-params.ts
 * @desc Search state in the URL, shared by the page and the route: the tab (pools or maps), the
 *       page (1 to 200) and each tab's filters, read from query params where anything that can't
 *       be read counts as unset (never an error), and written back with only what's set, in a
 *       fixed order, so equal searches share one URL (and one CDN entry). Ranges snap to their
 *       slider (open at the edges; a range covering the whole slider is no filter). The maps tab
 *       has a scope: all osu! maps (the default) or maps played in pools; the pools tab a type:
 *       past tournament pools (the default, and what a link without one means), built here (which
 *       reads no badged or star filter: built pools have neither), or both. `scope` wins when
 *       given; without it, a link carrying a played-only filter (ar, od, cs, played, used,
 *       last, or a sort) reads as played, so links from before the scope still work. A played
 *       search always writes scope=played; an all-maps search never writes a scope. The
 *       filters live in src/utils/search-filters.ts, the range, length and text helpers (shared
 *       with the map browser) in src/utils/search-ranges.ts, and the answers the route sends in
 *       src/schemas/search-response.ts. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { PLAYED_AS_CODES, type PlayedAsCode } from "@/constants/pools";
import {
  AR_RANGE,
  BADGED_FILTERS,
  BPM_RANGE,
  CS_RANGE,
  DEFAULT_MAP_SORT,
  DEFAULT_MAP_STATUS,
  DEFAULT_POOL_SORT,
  DEFAULT_POOL_TYPE,
  MAP_COUNT_RANGE,
  MAP_SORTS,
  MAP_STATUSES,
  MAX_MAP_REF_LENGTH,
  MAX_QUERY_LENGTH,
  type MapScope,
  OD_RANGE,
  POOL_SORTS,
  POOL_TYPES,
  STAR_RANGE,
  USED_RANGE,
  YEAR_RANGE,
} from "@/constants/search";
import type { Range, SearchState } from "@/utils/search-filters";
import {
  parseLengthRange,
  parsePageParam,
  parseRange,
  rangeText,
  wellFormed,
} from "@/utils/search-ranges";

/** `[low, high]`, `high` null for no upper limit. */

/** Searching every osu! map through the mirror. */

/** Params only a played-in-pools search has: a link carrying one predates the scope. */

const PLAYED_ONLY_PARAMS = ["ar", "od", "cs", "played", "used", "last", "sort"] as const;

/**
 * @function mapScopeOf
 * @param params {URLSearchParams} a maps search's params
 * @returns {MapScope} scope when it's all or played; else played for a link carrying a
 *          played-only filter, all otherwise
 */
export const mapScopeOf = (params: URLSearchParams): MapScope => {
  const scope = params.get("scope");
  if (scope === "all" || scope === "played") return scope;
  return PLAYED_ONLY_PARAMS.some((name) => (params.get(name) ?? "") !== "") ? "played" : "all";
};

const pick = <T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(raw ?? "") ? (raw as T) : fallback;

const parsePlayed = (raw: string | null): PlayedAsCode[] => {
  if (raw === null) return [];
  const picked = new Set(raw.split(",").map((value) => value.trim().toUpperCase()));
  return PLAYED_AS_CODES.filter((code) => picked.has(code));
};

/**
 * @function parseSearchState
 * @param search {string | URLSearchParams} a query string (with or without "?") or its params
 * @returns {SearchState} the tab (and the maps tab's scope), page and its filters
 */
export const parseSearchState = (search: string | URLSearchParams): SearchState => {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const page = parsePageParam(params.get("page"));
  const q = (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (params.get("tab") === "maps" && mapScopeOf(params) === "all") {
    return {
      tab: "maps",
      scope: "all",
      page,
      filters: {
        q,
        status: pick(params.get("status"), MAP_STATUSES, DEFAULT_MAP_STATUS),
        sr: parseRange(params.get("sr"), STAR_RANGE),
        len: parseLengthRange(params.get("len")),
        bpm: parseRange(params.get("bpm"), BPM_RANGE),
        explicit: params.get("explicit") === "show",
      },
    };
  }
  if (params.get("tab") === "maps") {
    return {
      tab: "maps",
      scope: "played",
      page,
      filters: {
        q,
        sr: parseRange(params.get("sr"), STAR_RANGE),
        len: parseLengthRange(params.get("len")),
        bpm: parseRange(params.get("bpm"), BPM_RANGE),
        ar: parseRange(params.get("ar"), AR_RANGE),
        od: parseRange(params.get("od"), OD_RANGE),
        cs: parseRange(params.get("cs"), CS_RANGE),
        played: parsePlayed(params.get("played")),
        used: parseRange(params.get("used"), USED_RANGE),
        last: parseRange(params.get("last"), YEAR_RANGE),
        sort: pick(params.get("sort"), MAP_SORTS, DEFAULT_MAP_SORT),
      },
    };
  }
  const type = pick(params.get("type"), POOL_TYPES, DEFAULT_POOL_TYPE);
  // Built pools have no badged or star data: those filters would hide every one of them.
  const built = type === "built";
  return {
    tab: "pools",
    page,
    filters: {
      type,
      q,
      year: parseRange(params.get("year"), YEAR_RANGE),
      badged: built ? "any" : pick(params.get("badged"), BADGED_FILTERS, "any"),
      sr: built ? null : parseRange(params.get("sr"), STAR_RANGE),
      maps: parseRange(params.get("maps"), MAP_COUNT_RANGE),
      map: (params.get("map") ?? "").trim().slice(0, MAX_MAP_REF_LENGTH),
      sort: pick(params.get("sort"), POOL_SORTS, DEFAULT_POOL_SORT),
    },
  };
};

/** A surrogate pair, or a surrogate on its own. */

/**
 * @function serializeSearchState
 * @param state {SearchState} a search
 * @returns {string} the query string without "?": tab (maps only), scope (played only), the
 *          tab's filters, sort or status (when not the default), page (from 2), and q last;
 *          empty for the defaults. Never throws.
 */
export const serializeSearchState = (state: SearchState): string => {
  const parts: string[] = [];
  const range = (name: string, value: Range | null) => {
    if (value) parts.push(`${name}=${rangeText(value)}`);
  };
  if (state.tab === "maps" && state.scope === "all") {
    const f = state.filters;
    parts.push("tab=maps");
    if (f.status !== DEFAULT_MAP_STATUS) parts.push(`status=${f.status}`);
    range("sr", f.sr);
    range("len", f.len);
    range("bpm", f.bpm);
    if (f.explicit) parts.push("explicit=show");
  } else if (state.tab === "maps") {
    const f = state.filters;
    parts.push("tab=maps&scope=played");
    range("sr", f.sr);
    range("len", f.len);
    range("bpm", f.bpm);
    range("ar", f.ar);
    range("od", f.od);
    range("cs", f.cs);
    if (f.played.length > 0) parts.push(`played=${f.played.join(",")}`);
    range("used", f.used);
    range("last", f.last);
    if (f.sort !== DEFAULT_MAP_SORT) parts.push(`sort=${f.sort}`);
  } else {
    const f = state.filters;
    if (f.type !== DEFAULT_POOL_TYPE) parts.push(`type=${f.type}`);
    range("year", f.year);
    if (f.badged !== "any") parts.push(`badged=${f.badged}`);
    range("sr", f.sr);
    range("maps", f.maps);
    if (f.map !== "") parts.push(`map=${encodeURIComponent(wellFormed(f.map))}`);
    if (f.sort !== DEFAULT_POOL_SORT) parts.push(`sort=${f.sort}`);
  }
  if (state.page > 1) parts.push(`page=${state.page}`);
  const q = wellFormed(state.filters.q).trim();
  if (q !== "") parts.push(`q=${encodeURIComponent(q)}`);
  return parts.join("&");
};

/**
 * @function searchHref
 * @param state {SearchState} a search
 * @returns {string} "/search" with the state's query string (none for the defaults)
 */
export const searchHref = (state: SearchState): string => {
  const search = serializeSearchState(state);
  return search === "" ? "/search" : `/search?${search}`;
};

/** A pool in search results: a past tournament pool, or one built here (with its owner). */

/** A map in search results. */

/** One osu! difficulty in all-maps results. */

/** One beatmapset in all-maps results (disallowed ones never are). */

/** What GET /api/search answers. */
