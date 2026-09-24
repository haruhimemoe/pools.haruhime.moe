/**
 * @file src/constants/db.ts
 * @desc Collection names in the pools database, the session TTL index name, and how long a
 *       public read may run (the cluster is a shared free M0).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

export const POOLS_COLLECTION = "pools";
export const MAPS_COLLECTION = "maps";
export const IMPORTS_COLLECTION = "imports";
export const SET_FACTS_COLLECTION = "setFacts";
export const RATE_LIMITS_COLLECTION = "rate_limits";

export const SESSION_TTL_INDEX = "session_expiresAt_ttl";

/** maxTimeMS on every public read. */
export const QUERY_TIME_MS = 2000;
