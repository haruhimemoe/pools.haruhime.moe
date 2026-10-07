/**
 * @file src/lib/db-indexes.ts
 * @desc Indexes on collections Mongoose doesn't manage, built with next-kit's ensureIndexes (each
 *       on its own, logged and skipped when it can't build, never thrown): the TTL on rate-limit
 *       counters, the 24-hour TTL on
 *       cached beatmapset facts and their difficulty-id index, pack_cleanup's due time, and
 *       api_keys' (next-kit's apiKeyIndexSpecs), and pool_revisions' (next-kit's
 *       revisionIndexSpecs: unique docId+seq, authorId, docId+kind+createdAt). Nothing in the
 *       hub's identity database: the hub owns its indexes. Pool, map and import indexes live on their Mongoose
 *       schemas (src/models).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { apiKeyIndexSpecs } from "@haruhimemoe/next-kit/api-keys";
import {
  ensureIndexes as buildIndexes,
  type IndexSpec,
  ttlIndex,
} from "@haruhimemoe/next-kit/mongo";
import { counterTtlIndex } from "@haruhimemoe/next-kit/server";
import { revisionIndexSpecs } from "@haruhimemoe/next-kit/vcs";
import type { Db } from "mongodb";
import {
  SET_FACTS_BEATMAPS_INDEX,
  SET_FACTS_TTL_INDEX,
  SET_FACTS_TTL_SECONDS,
} from "@/constants/compliance";
import {
  PACK_CLEANUP_COLLECTION,
  POOL_REVISIONS_COLLECTION,
  RATE_LIMITS_COLLECTION,
  SET_FACTS_COLLECTION,
} from "@/constants/db";

/** Every index connectDb makes sure of on collections without a Mongoose schema. */
export const RAW_INDEXES: readonly IndexSpec[] = [
  counterTtlIndex(RATE_LIMITS_COLLECTION),
  ttlIndex(SET_FACTS_COLLECTION, "fetchedAt", SET_FACTS_TTL_SECONDS, SET_FACTS_TTL_INDEX),
  { collection: SET_FACTS_COLLECTION, key: { beatmapIds: 1 }, name: SET_FACTS_BEATMAPS_INDEX },
  { collection: PACK_CLEANUP_COLLECTION, key: { nextAt: 1 } },
  ...apiKeyIndexSpecs(),
  ...revisionIndexSpecs(POOL_REVISIONS_COLLECTION),
];

/**
 * @function ensureIndexes
 * @param db {Db} the pools database
 * @returns {Promise<void>} every index built, or skipped and logged (never thrown): a missing
 *          index must not take the site down
 */
export const ensureIndexes = async (db: Db): Promise<void> => {
  await buildIndexes(db, RAW_INDEXES);
};
