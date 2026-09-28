/**
 * @file src/lib/db-indexes.ts
 * @desc Indexes on collections Mongoose doesn't manage, built with next-kit's ensureIndexes (each
 *       on its own, logged and skipped when it can't build, never thrown): better-auth's (one
 *       user per osu! id, one account per osu! link, one session per token, sessions by user,
 *       and the session TTL, so MongoDB deletes a sign-in session about a minute after it
 *       expires, as the privacy page says), the TTL on rate-limit counters, the 24-hour TTL on
 *       cached beatmapset facts and their difficulty-id index, and pack_cleanup's due time. A
 *       unique index over duplicate rows is skipped and logged (the duplicate osu! ids and links
 *       named, a session token never). Pool, map and import indexes live on their Mongoose
 *       schemas (src/models).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { AUTH_INDEX_SPECS } from "@haruhimemoe/next-kit/auth";
import {
  ensureIndexes as buildIndexes,
  type IndexSpec,
  ttlIndex,
} from "@haruhimemoe/next-kit/mongo";
import { counterTtlIndex } from "@haruhimemoe/next-kit/server";
import type { Db } from "mongodb";
import {
  SET_FACTS_BEATMAPS_INDEX,
  SET_FACTS_TTL_INDEX,
  SET_FACTS_TTL_SECONDS,
} from "@/constants/compliance";
import {
  PACK_CLEANUP_COLLECTION,
  RATE_LIMITS_COLLECTION,
  SET_FACTS_COLLECTION,
} from "@/constants/db";

/** Every index connectDb makes sure of on collections without a Mongoose schema. */
export const RAW_INDEXES: readonly IndexSpec[] = [
  ...AUTH_INDEX_SPECS,
  counterTtlIndex(RATE_LIMITS_COLLECTION),
  ttlIndex(SET_FACTS_COLLECTION, "fetchedAt", SET_FACTS_TTL_SECONDS, SET_FACTS_TTL_INDEX),
  { collection: SET_FACTS_COLLECTION, key: { beatmapIds: 1 }, name: SET_FACTS_BEATMAPS_INDEX },
  { collection: PACK_CLEANUP_COLLECTION, key: { nextAt: 1 } },
];

/**
 * @function ensureIndexes
 * @param db {Db} the pools database
 * @returns {Promise<void>} every index built, or skipped and logged (never thrown): a missing
 *          index must not take the site or sign-in down
 */
export const ensureIndexes = async (db: Db): Promise<void> => {
  await buildIndexes(db, RAW_INDEXES);
};
