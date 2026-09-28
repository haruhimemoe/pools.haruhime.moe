/**
 * @file src/constants/browse.ts
 * @desc The map browser (GET /api/maps/browse): the mod lenses it offers (those the mirror's
 *       pp-maps/stats also lists), the statuses the mirror's mod data covers, the mirror
 *       endpoints it calls and their timeout, how long the lens list is kept, the sorts, how many
 *       of a pool's maps it can leave out, and the failure copy and code.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

/** Mod lenses in picker order. The browser offers the ones the mirror lists too. */
export const BROWSE_LENSES = [
  "NM",
  "HD",
  "HR",
  "DT",
  "EZ",
  "HT",
  "FL",
  "HDHR",
  "HDDT",
  "HRDT",
  "HDHRDT",
  "EZDT",
  "EZHT",
] as const;
export type BrowseLens = (typeof BROWSE_LENSES)[number];
export const DEFAULT_LENS: BrowseLens = "NM";

/** Statuses the mirror's mod data covers; Qualified and Pending are searched without mods. */
export const LENS_STATUSES = ["ranked", "loved", "graveyard"] as const;
export type LensStatus = (typeof LENS_STATUSES)[number];

/** "Hide maps in this pool": a pool holds at most 64 maps. */
export const MAX_EXCLUDE_IDS = 64;

/** The mirror's search of its mod data: one difficulty a row, stars under the lens. */
export const NEKOHA_SEARCH_URL = "https://mirror.hinamizawa.ai/api/v1/nekoha-collab/search";
/** Lists the combos the mirror has data for (available_mods). */
export const PP_MAPS_STATS_URL = "https://mirror.hinamizawa.ai/v3/osu/pp-maps/stats";
export const BROWSE_TIMEOUT_MS = 10_000;
/** Rows a page asks for. */
export const BROWSE_PAGE_SIZE = 50;
/**
 * The mirror's sorts: favourites, stars, BPM and length, each high to low; it reads anything
 * else as pp, high to low, so "pp" asks for that. Most favourited first unless picked.
 */
export const BROWSE_SORTS = [
  "favourites_desc",
  "pp",
  "stars_desc",
  "bpm_desc",
  "length_desc",
] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];
export const DEFAULT_BROWSE_SORT: BrowseSort = "favourites_desc";
export const BROWSE_SORT_LABELS: Readonly<Record<BrowseSort, string>> = Object.freeze({
  favourites_desc: "Most favourited",
  pp: "Most pp",
  stars_desc: "Star rating, high to low",
  bpm_desc: "BPM, high to low",
  length_desc: "Longest first",
});

/** The mirror's lens list is kept an hour; after a failed fetch the built-in list is used a minute. */
export const LENS_LIST_TTL_MS = 3_600_000;
export const LENS_LIST_RETRY_MS = 60_000;

export const BROWSE_FAILED = "Map search isn't working right now.";
/** The code the route sends with BROWSE_FAILED (a 503, never cached). */
export const BROWSE_UNAVAILABLE_CODE = "browse_unavailable";
