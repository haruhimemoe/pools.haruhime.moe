/**
 * @file src/constants/db.ts
 * @desc Collection names in the pools database (built pools and their id claims included), how
 *       long a public read and a batch read (importer, admin) may run (the cluster is a shared
 *       free M0), and the index names searches hint (and the mod_values TTL index). better-auth's
 *       index names are next-kit's AUTH_INDEXES.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

/** Past pool records. */
export const POOLS_COLLECTION = "pools";
/** One row per beatmap, with its usage. */
export const MAPS_COLLECTION = "maps";
/** Import reports. */
export const IMPORTS_COLLECTION = "imports";
/** Cached beatmapset facts for the check. */
export const SET_FACTS_COLLECTION = "setFacts";
/** Rate-limit and osu! budget counters. */
export const RATE_LIMITS_COLLECTION = "rate_limits";
/** Pools people build here, and every built pool id ever handed out (so none is reused). */
export const BUILT_POOLS_COLLECTION = "built_pools";
/** Every built pool id ever claimed, so none is reused. */
export const BUILT_POOL_IDS_COLLECTION = "built_pool_ids";
/** Pack removals packs couldn't do yet, retried later (src/services/pack-cleanup.ts). */
export const PACK_CLEANUP_COLLECTION = "pack_cleanup";
/** Values under mods from the mirror, one row per beatmap id and combo. */
export const MOD_VALUES_COLLECTION = "mod_values";
/** Who changed what on built pools (src/services/built-pool-activity.ts). */
export const BUILT_POOL_ACTIVITY_COLLECTION = "built_pool_activity";

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

/** Index names on built_pools. */
export const BUILT_POOL_INDEXES = Object.freeze({
  owner: "ownerId_1_updatedAt_-1",
  editor: "editors.osuId_1",
  listed: "visibility_1_updatedAt_-1",
  hidden: "hidden_1",
  /** Search's "Built here", one per sort: public, not hidden. */
  searchYear: "visibility_1_hidden_1_year_-1__id_1",
  searchName: "visibility_1_hidden_1_sortName_1__id_1",
  searchMaps: "visibility_1_hidden_1_mapCount_-1__id_1",
  /** Admin's recent built pools. */
  recent: "createdAt_-1",
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

/** Index names on built_pool_activity. */
export const BUILT_POOL_ACTIVITY_INDEXES = Object.freeze({
  /** A pool's entries, newest first (the editor's list, the trim). */
  pool: "poolId_1_at_-1__id_-1",
  /** Entries go 180 days after they were written. */
  ttl: "built_pool_activity_at_ttl",
  /** A deleted account's entries, to rename. */
  osuId: "osuId_1",
  /** Entries naming a deleted account, to take the name out. */
  subject: "subject.osuId_1",
});
