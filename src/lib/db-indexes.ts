/**
 * @file src/lib/db-indexes.ts
 * @desc Indexes on collections Mongoose doesn't manage: the session TTL (MongoDB deletes a
 *       sign-in session about a minute after it expires, as the privacy page says) and the TTL
 *       on rate-limit counters. Pool, map and import indexes live on their Mongoose schemas
 *       (src/models). createIndex is a no-op when the index already exists.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import type { Db } from "mongodb";
import { RATE_LIMITS_COLLECTION, SESSION_TTL_INDEX } from "@/constants/db";

/**
 * @function ensureIndexes
 * @param db {Db} the pools database
 * @returns {Promise<void>} resolves even when an index can't be created (logged, never thrown):
 *          a missing TTL index must not take the site down
 */
export const ensureIndexes = async (db: Db): Promise<void> => {
  try {
    await Promise.all([
      db
        .collection("session")
        .createIndex({ expiresAt: 1 }, { name: SESSION_TTL_INDEX, expireAfterSeconds: 0 }),
      db
        .collection(RATE_LIMITS_COLLECTION)
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]);
  } catch (error) {
    console.error("db: couldn't create indexes", error);
  }
};
