/**
 * @file tests/helpers/db.ts
 * @desc setupTestDb(): next-kit's per-file database hooks with pools' connect, database and
 *       collections: each test starts with every pools collection empty, and the client closes
 *       after the file. The hub's identity users and sessions (which tests/helpers/auth.ts
 *       writes, standing in for the hub) are emptied too.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import { setupTestDb as setupKitDb } from "@haruhimemoe/next-kit/testing";
import { beforeEach } from "vitest";
import { closeDb, connectDb, getDb, getIdentityDb } from "@/lib/db";

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
];

/** The identity collections the session reader reads. */
const IDENTITY_COLLECTIONS = ["user", "session"];

/**
 * @function setupTestDb
 * @returns {void} registers beforeEach (connect, then clear) and afterAll (close) hooks
 */
export const setupTestDb = (): void => {
  setupKitDb({ connect: connectDb, db: getDb, close: closeDb, collections: COLLECTIONS });
  beforeEach(async () => {
    const identity = getIdentityDb();
    await Promise.all(IDENTITY_COLLECTIONS.map((name) => identity.collection(name).deleteMany({})));
  });
};
