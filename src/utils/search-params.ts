/**
 * @file src/utils/search-params.ts
 * @desc Search state in the URL, shared by the page and the route: the tab (pools or maps), the
 *       page (1 to 200) and each tab's filters, read from query params where anything that can't
 *       be read counts as unset (never an error), and written back with only what's set, in a
 *       fixed order, so equal searches share one URL (and one CDN entry). Ranges snap to their
 *       slider (open at the edges; a range covering the whole slider is no filter). The maps tab
 *       has a scope: all osu! maps (the default) or maps played in pools. `scope` wins when
 *       given; without it, a link carrying a played-only filter (ar, od, cs, played, used,
 *       last, or a sort) reads as played, so links from before the scope still work. A played
 *       search always writes scope=played; an all-maps search never writes a scope. Also the
 *       answer shapes the route sends. Pure, and safe in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

import { PLAYED_AS_CODES, type PlayedAsCode } from "@/constants/pools";
import {
  AR_RANGE,
  BADGED_FILTERS,
  type BadgedFilter,
  BPM_RANGE,
  CS_RANGE,
  DEFAULT_MAP_SORT,
  DEFAULT_MAP_STATUS,
  DEFAULT_POOL_SORT,
  type FilterBounds,
  LENGTH_RANGE,
  MAP_COUNT_RANGE,
  MAP_SORTS,
  MAP_STATUSES,
  MAX_MAP_REF_LENGTH,
  MAX_QUERY_LENGTH,
  MAX_SEARCH_PAGE,
  type MapScope,
  type MapSort,
  type MapStatus,
  OD_RANGE,
  POOL_SORTS,
  type PoolSort,
  STAR_RANGE,
  USED_RANGE,
  YEAR_RANGE,
} from "@/constants/search";

/** `[low, high]`, `high` null for no upper limit. */
export type Range = readonly [number, number | null];

export type PoolFilters = {
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

/** Searching every osu! map through the mirror. */
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

const round = (n: number, decimals: number): number => {
  const scale = 10 ** decimals;
  return Math.round(n * scale) / scale;
};

/**
 * @function normalizeRange
 * @param range {readonly [number, number | null]} a range from a slider or a URL
 * @param bounds {FilterBounds} the slider's bounds
 * @returns {Range | null} the range inside the bounds and rounded, its top null at the maximum;
 *          null when it covers the whole slider, is crossed, or isn't a number
 */
export const normalizeRange = (
  range: readonly [number, number | null],
  bounds: FilterBounds,
): Range | null => {
  const [rawLow, rawHigh] = range;
  if (!Number.isFinite(rawLow) || (rawHigh !== null && !Number.isFinite(rawHigh))) return null;
  const low = round(Math.min(Math.max(rawLow, bounds.min), bounds.max), bounds.decimals);
  const high =
    rawHigh === null || rawHigh >= bounds.max
      ? null
      : round(Math.max(rawHigh, bounds.min), bounds.decimals);
  if (high !== null && high < low) return null;
  if (low <= bounds.min && high === null) return null;
  return [low, high];
};

/**
 * @function parseLengthText
 * @param text {string} a typed length
 * @returns {number | null} seconds: "1:35" is 95, a bare number is minutes ("2,5" is 150); null
 *          for anything else
 */
export const parseLengthText = (text: string): number | null => {
  const trimmed = text.trim().replace(",", ".");
  const clock = /^(\d+):(\d+)$/.exec(trimmed);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 60);
  return null;
};

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
const RANGE_TEXT = new RegExp(`^(${NUMBER})?-(${NUMBER})?$`);
const OPEN_TEXT = new RegExp(`^(${NUMBER})\\+?$`);
const toNumber = (text: string): number => Number(text.replace(",", "."));

/** "5.5-6.5", "6-", "-6.5", "6+" (6 and up). */
const parseRange = (raw: string | null, bounds: FilterBounds): Range | null => {
  if (raw === null) return null;
  const text = raw.trim();
  const open = OPEN_TEXT.exec(text);
  if (open?.[1] !== undefined) return normalizeRange([toNumber(open[1]), null], bounds);
  const range = RANGE_TEXT.exec(text);
  if (!range || (range[1] === undefined && range[2] === undefined)) return null;
  return normalizeRange(
    [
      range[1] === undefined ? bounds.min : toNumber(range[1]),
      range[2] === undefined ? null : toNumber(range[2]),
    ],
    bounds,
  );
};

/** Lengths may be "1:30-3:00" as well as seconds. */
const parseLengthRange = (raw: string | null): Range | null => {
  if (raw === null) return null;
  const [low, high, ...rest] = raw.split("-");
  if (rest.length > 0 || low === undefined || high === undefined)
    return parseRange(raw, LENGTH_RANGE);
  if (!low.includes(":") && !high.includes(":")) return parseRange(raw, LENGTH_RANGE);
  const from =
    low === "" ? LENGTH_RANGE.min : parseLengthText(low.includes(":") ? low : `0:${low}`);
  const to = high === "" ? null : parseLengthText(high.includes(":") ? high : `0:${high}`);
  if (from === null || (high !== "" && to === null)) return null;
  return normalizeRange([from, to], LENGTH_RANGE);
};

/**
 * @function parsePageParam
 * @param raw {string | null} an untrusted page number
 * @returns {number} 1 for anything that isn't a whole number from 1; at most MAX_SEARCH_PAGE
 */
export const parsePageParam = (raw: string | null): number =>
  raw !== null && /^[1-9]\d{0,5}$/.test(raw) ? Math.min(Number(raw), MAX_SEARCH_PAGE) : 1;

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
  return {
    tab: "pools",
    page,
    filters: {
      q,
      year: parseRange(params.get("year"), YEAR_RANGE),
      badged: pick(params.get("badged"), BADGED_FILTERS, "any"),
      sr: parseRange(params.get("sr"), STAR_RANGE),
      maps: parseRange(params.get("maps"), MAP_COUNT_RANGE),
      map: (params.get("map") ?? "").trim().slice(0, MAX_MAP_REF_LENGTH),
      sort: pick(params.get("sort"), POOL_SORTS, DEFAULT_POOL_SORT),
    },
  };
};

const rangeText = ([low, high]: Range): string => `${low}-${high ?? ""}`;

/** A surrogate pair, or a surrogate on its own. */
const SURROGATES = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

/** Each lone surrogate as U+FFFD (encodeURIComponent throws on one). */
const wellFormed = (text: string): string =>
  text.replace(SURROGATES, (match) => (match.length === 2 ? match : "�"));

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

/**
 * @function hasPoolFilters
 * @param filters {PoolFilters} pool filters
 * @returns {boolean} whether any filter row is set (the text and sort aside)
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

/** A pool in search results. */
export type PoolResult = {
  id: string;
  name: string;
  tournament: string;
  round: string | null;
  year: number | null;
  badged: boolean | null;
  stats: { srMin: number | null; srMax: number | null; count: number; complete: boolean };
};

/** A map in search results. */
export type MapResult = {
  id: number;
  artist: string | null;
  title: string | null;
  version: string | null;
  setHost: string | null;
  stars: number | null;
  length: number | null;
  bpm: number | null;
  usage: { count: number; lastYear: number | null; playedAs: PlayedAsCode[] };
};

/** One osu! difficulty in all-maps results. */
export type AllMapDifficulty = {
  id: number;
  version: string;
  stars: number;
  length: number;
  bpm: number;
  /** Current pools that played it; null when that lookup failed. */
  playedIn: number | null;
};

/** One beatmapset in all-maps results (disallowed ones never are). */
export type AllMapSet = {
  setId: number;
  artist: string;
  title: string;
  creator: string;
  status: string;
  /** Graveyard, pending or WIP: it can change or disappear. */
  unranked: boolean;
  /** Null when nothing stands in its way; potential sets say why to check first. */
  check: { text: string } | null;
  maps: AllMapDifficulty[];
};

/** What GET /api/search answers. */
export type SearchResponse =
  | {
      tab: "pools";
      page: number;
      pageCount: number;
      total: number;
      hiddenMissing: number;
      badgedKnown: boolean;
      results: PoolResult[];
    }
  | {
      tab: "maps";
      scope: "played";
      page: number;
      pageCount: number;
      total: number;
      hiddenMissing: number;
      results: MapResult[];
    }
  | {
      tab: "maps";
      scope: "all";
      page: number;
      pageCount: number;
      /** The mirror's total, when it gives one. */
      total: number | null;
      /** Sets on this page left out as not allowed in officially supported tournaments. */
      hidden: number;
      results: AllMapSet[];
    };
