/**
 * @file src/utils/browse-params.ts
 * @desc The map browser's query params (GET /api/maps/browse), read where anything that can't be
 *       read counts as its default (never an error) and written back with only what's set, in a
 *       fixed order, so equal searches share one URL and one CDN entry. The lens is a combo from
 *       BROWSE_LENSES in any order (NC reads as DT); whether the mirror offers it is the
 *       service's call. The sort is one of the mirror's (most favourited unless picked). Ranges snap to the search sliders and are under the lens. excludeIds
 *       ("hide maps in this pool") is 1 to 64 beatmap ids, kept once and sorted; one bad id or
 *       more than 64 reads as none. Also the answer shapes the route sends. Pure, and safe in
 *       the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { beatmapIdSchema } from "@haruhimemoe/pool";
import {
  BROWSE_LENSES,
  BROWSE_SORTS,
  type BrowseLens,
  type BrowseSort,
  DEFAULT_BROWSE_SORT,
  DEFAULT_LENS,
  MAX_EXCLUDE_IDS,
} from "@/constants/browse";
import {
  AR_RANGE,
  BPM_RANGE,
  DEFAULT_MAP_STATUS,
  MAP_STATUSES,
  MAX_QUERY_LENGTH,
  type MapStatus,
  OD_RANGE,
  STAR_RANGE,
} from "@/constants/search";
import { modsCode, parseMods } from "@/utils/mod-values";
import {
  parseLengthRange,
  parsePageParam,
  parseRange,
  type Range,
  rangeText,
  wellFormed,
} from "@/utils/search-params";

export type BrowseParams = {
  q: string;
  lens: BrowseLens;
  status: MapStatus;
  /** The mirror's order (Ranked, Loved and Graveyard only). */
  sort: BrowseSort;
  /** Star rating, BPM, length (seconds), AR and OD, all under the lens. */
  sr: Range | null;
  bpm: Range | null;
  len: Range | null;
  ar: Range | null;
  od: Range | null;
  /** The pool's own maps, left out. */
  excludeIds: number[];
  /** Leave out maps played in past pools. */
  hidePlayed: boolean;
  /** Show explicit maps (hidden unless asked). */
  explicit: boolean;
  page: number;
};

export const DEFAULT_BROWSE_PARAMS: BrowseParams = Object.freeze({
  q: "",
  lens: DEFAULT_LENS,
  status: DEFAULT_MAP_STATUS,
  sort: DEFAULT_BROWSE_SORT,
  sr: null,
  bpm: null,
  len: null,
  ar: null,
  od: null,
  excludeIds: [],
  hidePlayed: false,
  explicit: false,
  page: 1,
}) as BrowseParams;

/**
 * @function parseLens
 * @param raw {string | null} a lens as written
 * @returns {BrowseLens} its canonical combo when BROWSE_LENSES has it, else NM
 */
export const parseLens = (raw: string | null): BrowseLens => {
  const mods = parseMods(raw ?? "");
  const code = mods === null ? DEFAULT_LENS : modsCode(mods);
  return (BROWSE_LENSES as readonly string[]).includes(code) ? (code as BrowseLens) : DEFAULT_LENS;
};

/** 1 to 64 distinct valid ids, sorted; anything else is none. */
const parseExcludeIds = (raw: string | null): number[] => {
  if (raw === null || raw === "") return [];
  const parts = raw.split(",");
  if (!parts.every((part) => /^\d{1,10}$/.test(part))) return [];
  const ids = [...new Set(parts.map(Number))].sort((a, b) => a - b);
  const valid = ids.every((id) => beatmapIdSchema.safeParse(id).success);
  return valid && ids.length <= MAX_EXCLUDE_IDS ? ids : [];
};

/**
 * @function parseBrowseParams
 * @param search {string | URLSearchParams} a query string (with or without "?") or its params
 * @returns {BrowseParams} every param, each unreadable one at its default
 */
export const parseBrowseParams = (search: string | URLSearchParams): BrowseParams => {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const status = params.get("status") ?? "";
  const sort = params.get("sort") ?? "";
  const hidePlayed = params.get("hidePlayed");
  return {
    q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    lens: parseLens(params.get("lens")),
    status: (MAP_STATUSES as readonly string[]).includes(status)
      ? (status as MapStatus)
      : DEFAULT_MAP_STATUS,
    sort: (BROWSE_SORTS as readonly string[]).includes(sort)
      ? (sort as BrowseSort)
      : DEFAULT_BROWSE_SORT,
    sr: parseRange(params.get("sr"), STAR_RANGE),
    bpm: parseRange(params.get("bpm"), BPM_RANGE),
    len: parseLengthRange(params.get("len")),
    ar: parseRange(params.get("ar"), AR_RANGE),
    od: parseRange(params.get("od"), OD_RANGE),
    excludeIds: parseExcludeIds(params.get("excludeIds")),
    hidePlayed: hidePlayed === "1" || hidePlayed === "true",
    explicit: params.get("explicit") === "show",
    page: parsePageParam(params.get("page")),
  };
};

/**
 * @function serializeBrowseParams
 * @param params {BrowseParams} a browse
 * @returns {string} the query string without "?": lens, status and sort (when not the default), the
 *          ranges, excludeIds, hidePlayed, explicit, page (from 2), and q last; empty for the
 *          defaults. Never throws.
 */
export const serializeBrowseParams = (params: BrowseParams): string => {
  const parts: string[] = [];
  const range = (name: string, value: Range | null) => {
    if (value) parts.push(`${name}=${rangeText(value)}`);
  };
  if (params.lens !== DEFAULT_LENS) parts.push(`lens=${params.lens}`);
  if (params.status !== DEFAULT_MAP_STATUS) parts.push(`status=${params.status}`);
  if (params.sort !== DEFAULT_BROWSE_SORT) parts.push(`sort=${params.sort}`);
  range("sr", params.sr);
  range("bpm", params.bpm);
  range("len", params.len);
  range("ar", params.ar);
  range("od", params.od);
  if (params.excludeIds.length > 0) parts.push(`excludeIds=${params.excludeIds.join(",")}`);
  if (params.hidePlayed) parts.push("hidePlayed=1");
  if (params.explicit) parts.push("explicit=show");
  if (params.page > 1) parts.push(`page=${params.page}`);
  const q = wellFormed(params.q).trim();
  if (q !== "") parts.push(`q=${encodeURIComponent(q)}`);
  return parts.join("&");
};

/**
 * @function browseApiUrl
 * @param params {BrowseParams} a browse
 * @returns {string} "/api/maps/browse" with the params' query string (none for the defaults)
 */
export const browseApiUrl = (params: BrowseParams): string => {
  const search = serializeBrowseParams(params);
  return search === "" ? "/api/maps/browse" : `/api/maps/browse?${search}`;
};

/** One osu!standard difficulty in the browser, with its values under the lens. */
export type BrowseDiff = {
  id: number;
  version: string;
  /** Under the lens (without mods when modValuesAvailable is false). */
  stars: number;
  starsNoMod: number;
  /** Under the lens; null when unknown. */
  ar: number | null;
  od: number | null;
  cs: number | null;
  bpm: number;
  /** Seconds, under the lens. */
  length: number;
  /** Current past pools that played it; null when that lookup failed. */
  playedIn: number | null;
  /** "math": no mod data from the mirror, AR, OD and CS computed (or unknown). */
  source: "mirror" | "math";
};

/** One beatmapset in the browser (disallowed ones never are). */
export type BrowseSet = {
  setId: number;
  artist: string;
  title: string;
  creator: string;
  status: string;
  /** Graveyard, pending or WIP: it can change or disappear. */
  unranked: boolean;
  /** Null when nothing stands in its way; potential sets say why to check first. */
  check: { text: string } | null;
  diffs: BrowseDiff[];
};

/** What GET /api/maps/browse answers. */
export type BrowseResponse = {
  /** The lens used: NM for Qualified and Pending, and for a lens the mirror doesn't offer. */
  lens: BrowseLens;
  /** The lenses on offer, in picker order. */
  lenses: BrowseLens[];
  status: MapStatus;
  page: number;
  pageCount: number | null;
  /** The mirror's total (difficulties with a lens, sets without), when it gives one. */
  total: number | null;
  /** Sets on this page left out as not allowed in officially supported tournaments. */
  hidden: number;
  /** Difficulties the BPM, length, AR and OD filters left out of this page. */
  filteredOnPage: number;
  /** Difficulties left out as already in the pool (excludeIds). */
  excluded: number;
  /** Difficulties left out as played in past pools (hidePlayed). */
  playedHidden: number;
  /** False for Qualified and Pending: stars, AR and OD are without mods. */
  modValuesAvailable: boolean;
  sets: BrowseSet[];
};
