/**
 * @file src/services/built-moderation.ts
 * @desc Admins' view of pools built here: the newest ones (with owner, visibility, hidden, map
 *       count and pack state) and hiding or unhiding one. A hide is a new version (the editor's
 *       poll shows its owner the notice) and marks a public pool's pack pending, so the route
 *       sends it to packs as unlisted at once (packs keeps its own moderators' hides). Deleting
 *       goes through deleteBuiltPool, the owner's path, pack removal included.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import type { BuiltPackState, Visibility } from "@/constants/built-pools";
import { BUILT_POOL_INDEXES, QUERY_TIME_MS } from "@/constants/db";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import { markPackPending, ownerNamesOf, readBuiltPool } from "@/services/built-pools";

/** Built pools /admin lists. */
export const ADMIN_BUILT_LIMIT = 50;

export type AdminBuiltPool = {
  id: string;
  name: string;
  owner: string | null;
  visibility: Visibility;
  hidden: boolean;
  maps: number;
  pack: BuiltPackState;
  createdAt: Date;
};

/**
 * @function listRecentBuiltPools
 * @param limit {number} how many (default 50)
 * @returns {Promise<AdminBuiltPool[]>} the newest built pools, every visibility, rows of the
 *          wrong shape left out
 */
export const listRecentBuiltPools = async (
  limit: number = ADMIN_BUILT_LIMIT,
): Promise<AdminBuiltPool[]> => {
  const rows = await (await builtPoolsCollection())
    .find({}, { sort: { createdAt: -1 }, hint: BUILT_POOL_INDEXES.recent, limit })
    .maxTimeMS(QUERY_TIME_MS)
    .toArray();
  const pools = rows.map(readBuiltPool).flatMap((pool) => (pool ? [pool] : []));
  const owners = await ownerNamesOf(pools.map((pool) => pool.ownerId));
  return pools.map((pool) => ({
    id: pool._id,
    name: pool.name,
    owner: owners.get(pool.ownerId) ?? null,
    visibility: pool.visibility,
    hidden: pool.hidden,
    maps: pool.slots.length,
    pack: pool.pack.state,
    createdAt: pool.createdAt,
  }));
};

/**
 * @function setBuiltPoolHidden
 * @param id {string} an untrusted built pool id
 * @param hidden {boolean} hide it, or show it again
 * @param now {Date} current time (tests)
 * @returns {Promise<{ pool: StoredBuiltPool; changed: boolean } | null>} the pool after (a new
 *          version when it changed; a public one's pack pending), or null when it isn't there
 */
export const setBuiltPoolHidden = async (
  id: string,
  hidden: boolean,
  now: Date = new Date(),
): Promise<{ pool: StoredBuiltPool; changed: boolean } | null> => {
  const pools = await builtPoolsCollection();
  const updated = readBuiltPool(
    await pools.findOneAndUpdate(
      { _id: id, hidden: !hidden },
      { $set: { hidden, updatedAt: now }, $inc: { version: 1 } },
      { returnDocument: "after" },
    ),
  );
  if (!updated) {
    const pool = readBuiltPool(await pools.findOne({ _id: id }));
    return pool ? { pool, changed: false } : null;
  }
  // Only a public pool's pack changes: packs lists it, or not.
  const marked = updated.visibility === "public" ? await markPackPending(id) : null;
  return { pool: marked ?? updated, changed: true };
};
