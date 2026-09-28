/**
 * @file src/utils/browse-state.ts
 * @desc The map browser's state as the editor keeps it: the browse params with "hide maps in
 *       this pool" as a switch (the ids come from the pool when a search goes out). It lives in
 *       the editor's URL as one `browse` param holding the browser's own query, so a refresh
 *       keeps it and the editor's other params are left alone; at the defaults the param goes.
 *       The request: Qualified and Pending are searched without mods, so their lens is NM and
 *       the sort (the mod data's) isn't sent; explicit only applies to them. Pure, and safe in
 *       the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import {
  type BrowseLens,
  DEFAULT_BROWSE_SORT,
  DEFAULT_LENS,
  LENS_STATUSES,
  MAX_EXCLUDE_IDS,
} from "@/constants/browse";
import type { MapStatus } from "@/constants/search";
import {
  type BrowseParams,
  browseApiUrl,
  DEFAULT_BROWSE_PARAMS,
  parseBrowseParams,
  serializeBrowseParams,
} from "@/utils/browse-params";

export type BrowseState = Omit<BrowseParams, "excludeIds"> & {
  /** "Hide maps in this pool". */
  hideInPool: boolean;
};

const { excludeIds: _, ...defaults } = DEFAULT_BROWSE_PARAMS;
export const DEFAULT_BROWSE_STATE: BrowseState = Object.freeze({ ...defaults, hideInPool: false });

/** The editor URL's param that holds the browser's query. */
export const BROWSE_URL_PARAM = "browse";

/**
 * @function isLensStatus
 * @param status {MapStatus} a status
 * @returns {boolean} true for Ranked, Loved and Graveyard (searched with mod data)
 */
export const isLensStatus = (status: MapStatus): boolean =>
  (LENS_STATUSES as readonly string[]).includes(status);

/**
 * @function lensOf
 * @param state {BrowseState} the browser's state
 * @returns {BrowseLens} the lens results are under: NM for Qualified and Pending
 */
export const lensOf = (state: BrowseState): BrowseLens =>
  isLensStatus(state.status) ? state.lens : DEFAULT_LENS;

const queryOf = (state: BrowseState): string => {
  const { hideInPool, ...params } = state;
  const text = serializeBrowseParams({ ...params, excludeIds: [] });
  return hideInPool ? [text, "inPool=hide"].filter(Boolean).join("&") : text;
};

const readSearch = (search: string): URLSearchParams => {
  try {
    return new URLSearchParams(search);
  } catch {
    return new URLSearchParams();
  }
};

/**
 * @function readBrowseState
 * @param search {string} the editor's query string (location.search)
 * @returns {BrowseState} the browser's state it holds; anything unreadable at its default
 */
export const readBrowseState = (search: string): BrowseState => {
  const inner = readSearch(readSearch(search).get(BROWSE_URL_PARAM) ?? "");
  const { excludeIds: _ids, ...params } = parseBrowseParams(inner);
  return { ...params, hideInPool: inner.get("inPool") === "hide" };
};

/**
 * @function editorSearchFor
 * @param search {string} the editor's query string now
 * @param state {BrowseState} the browser's state
 * @returns {string} the query string with `browse` set to it ("?…", or "" when nothing's left)
 */
export const editorSearchFor = (search: string, state: BrowseState): string => {
  const params = readSearch(search);
  const query = queryOf(state);
  if (query === "") params.delete(BROWSE_URL_PARAM);
  else params.set(BROWSE_URL_PARAM, query);
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
};

/**
 * @function browseRequestUrl
 * @param state {BrowseState} the browser's state
 * @param poolIds {readonly number[]} the pool's beatmap ids now
 * @returns {string} the GET /api/maps/browse URL for it
 */
export const browseRequestUrl = (state: BrowseState, poolIds: readonly number[]): string => {
  const { hideInPool, ...params } = state;
  const withMods = isLensStatus(state.status);
  const ids = hideInPool ? [...new Set(poolIds)].sort((a, b) => a - b) : [];
  return browseApiUrl({
    ...params,
    lens: lensOf(state),
    sort: withMods ? state.sort : DEFAULT_BROWSE_SORT,
    explicit: withMods ? false : state.explicit,
    excludeIds: ids.slice(0, MAX_EXCLUDE_IDS),
  });
};
