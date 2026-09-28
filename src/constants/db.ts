/**
 * @file src/constants/db.ts
 * @desc Collection names in the pools database, the session TTL index name, how long a public
 *       read and a batch read (importer, admin) may run (the cluster is a shared free M0), and
 *       the index names searches hint (and the mod_values TTL index).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

export const POOLS_COLLECTION = "pools";
export const MAPS_COLLECTION = "maps";
export const IMPORTS_COLLECTION = "imports";
export const SET_FACTS_COLLECTION = "setFacts";
export const RATE_LIMITS_COLLECTION = "rate_limits";
/** Values under mods from the mirror, one row per beatmap id and combo. */
export const MOD_VALUES_COLLECTION = "mod_values";

export const SESSION_TTL_INDEX = "session_expiresAt_ttl";

/** maxTimeMS on every public read. */
export const QUERY_TIME_MS = 2000;

/** Index names on pools: public searches hint the one that backs their sort. */
export const POOL_INDEXES = Object.freeze({
  fingerprint: "fingerprint_current",
  year: "visible_1_year_-1__id_1",
  name: "visible_1_sortName_1__id_1",
  maps: "visible_1_stats.count_-1__id_1",
  /** The home page's Recently added. */
  recent: "visible_1_createdAt_-1__id_1",
  beatmap: "slots.beatmapId_1",
  source: "sources.kind_1_sources.id_1",
  tournament: "tournamentKey_1_year_1",
  badged: "visible_1_badged_1",
  packState: "pack.state_1",
});

/** Index names on maps. */
export const MAP_INDEXES = Object.freeze({
  used: "usage.count_-1__id_1",
  last: "usage.lastYear_-1__id_1",
  stars: "stars_-1__id_1",
  length: "length_-1__id_1",
  title: "sortTitle_1__id_1",
  set: "setId_1",
  metaSource: "metaSource_1",
});

/** maxTimeMS for the importer's and the admin's batch reads over every pool or map. */
export const BATCH_QUERY_MS = 60_000;

/** Index names on mod_values. */
export const MOD_VALUES_INDEXES = Object.freeze({
  ttl: "mod_values_fetchedAt_ttl",
});
