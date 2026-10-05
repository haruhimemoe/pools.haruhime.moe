/**
 * @file tests/helpers/db.ts
 * @desc setupTestDb(): next-kit's per-file database hooks with pools' connect, database and
 *       collections (ours plus better-auth's): each test starts with every collection empty, and
 *       the client closes after the file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Oct 5, 2026
 */

import { BETTER_AUTH_COLLECTIONS, setupTestDb as setupKitDb } from "@haruhimemoe/next-kit/testing";
import { closeDb, connectDb, getDb } from "@/lib/db";

/** Every collection pools writes. */
const COLLECTIONS = [
  "pools",
  "maps",
  "imports",
  "setFacts",
  "rate_limits",
  "built_pools",
  "built_pool_ids",
  "pool_revisions",
  "mod_values",
  "pack_cleanup",
  "built_pool_activity",
  "api_keys",
  "similar_maps",
  ...BETTER_AUTH_COLLECTIONS,
];

/**
 * @function setupTestDb
 * @returns {void} registers beforeEach (connect, then clear) and afterAll (close) hooks
 */
export const setupTestDb = (): void =>
  setupKitDb({ connect: connectDb, db: getDb, close: closeDb, collections: COLLECTIONS });
