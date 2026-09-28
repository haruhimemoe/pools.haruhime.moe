/**
 * @file src/services/built-pools.ts
 * @desc Changes to built pools that aren't content: marking a pack pending after a change
 *       (WANTS_PACK_SYNC), changing who sees a pool, and deleting one. A pool with a pack on
 *       packs loses the pack (going private, being deleted); when packs can't be asked, the
 *       change goes ahead and the removal is queued (src/services/pack-cleanup.ts), and the
 *       answer says so. Lists a user's pools for their account page. Reading a pool is
 *       src/services/built-pool-read.ts; answers are src/utils/built-answer.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import type { Filter } from "mongodb";
import { MAX_POOLS_PER_OWNER, type Visibility } from "@/constants/built-pools";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { SessionUser } from "@/schemas/session-user";
import { deleteActivityOf, recordFor } from "@/services/built-pool-activity";
import { loadFor, readBuiltPool, viewOf } from "@/services/built-pool-read";
import { type PackRemoval, removePackOrQueue } from "@/services/pack-cleanup";
import { visibilityActivity } from "@/utils/activity";
import type { Caller } from "@/utils/built-access";
import { type Answer, type BuiltPoolView, NOT_FOUND, refuse } from "@/utils/built-answer";
import { EMPTY_BUILT_PACK } from "@/utils/built-pack";

/**
 * Pools a change sends to packs: unlisted or public, not removed by packs' moderators, and with
 * maps or a pack to take down (any state but none: a first PUT that failed on our side may
 * still have made one, so it has no slug yet).
 */
export const WANTS_PACK_SYNC: Filter<StoredBuiltPool> = {
  visibility: { $ne: "private" },
  "pack.gone": { $ne: true },
  $or: [{ "slots.0": { $exists: true } }, { "pack.state": { $ne: "none" } }],
};

/**
 * @function markPackPending
 * @param id {string} a built pool that just changed
 * @returns {Promise<StoredBuiltPool | null>} the pool with its pack marked pending, or null when
 *          it has nothing for packs: it's private, packs' moderators removed its pack, or it's
 *          empty and has no pack yet
 */
export const markPackPending = async (id: string): Promise<StoredBuiltPool | null> =>
  readBuiltPool(
    await (await builtPoolsCollection()).findOneAndUpdate(
      { _id: id, ...WANTS_PACK_SYNC },
      { $set: { "pack.state": "pending" } },
      { returnDocument: "after" },
    ),
  );

/**
 * @function deleteBuiltPool
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} the owner or an admin
 * @returns {Promise<Answer<{ packRemoval: PackRemoval }>>} ok once the pool is gone, with what
 *          happened to its pack (none, removed, or queued because packs couldn't be asked); its
 *          id stays claimed, so it's never handed out again
 */
export const deleteBuiltPool = async (
  id: string,
  caller: Caller,
): Promise<Answer<{ packRemoval: PackRemoval }>> => {
  const loaded = await loadFor(id, caller, (access) => access.canDelete);
  if (!loaded.ok) return loaded;
  const packRemoval = await removePackOrQueue(loaded.value.pool);
  await (await builtPoolsCollection()).deleteOne({ _id: id });
  await deleteActivityOf([id]);
  return { ok: true, value: { packRemoval } };
};

/**
 * @function setBuiltPoolVisibility
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} the owner
 * @param visibility {Visibility} who may see it now
 * @returns {Promise<Answer<{ pool: BuiltPoolView; packRemoval: PackRemoval }>>} the pool
 *          after the change (a new version unless nothing changed) and what happened to its
 *          pack: going private removes it, or queues its removal when packs can't be asked
 */
export const setBuiltPoolVisibility = async (
  id: string,
  caller: Caller,
  visibility: Visibility,
): Promise<Answer<{ pool: BuiltPoolView; packRemoval: PackRemoval }>> => {
  const loaded = await loadFor(id, caller, (access) => access.canManage);
  if (!loaded.ok) return loaded;
  const { pool } = loaded.value;
  if (pool.visibility === visibility) {
    return { ok: true, value: { pool: await viewOf(pool, caller), packRemoval: "none" } };
  }
  const packRemoval = visibility === "private" ? await removePackOrQueue(pool) : "none";
  // packs' 410 stays: a pool packs' moderators removed never syncs again, private or not.
  const pack = visibility === "private" ? { ...EMPTY_BUILT_PACK, gone: pool.pack.gone } : pool.pack;
  const updated = await (await builtPoolsCollection()).findOneAndUpdate(
    { _id: id },
    { $set: { visibility, pack, updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: "after" },
  );
  // Unlisted and public pools' packs follow their visibility.
  const parsed =
    (visibility !== "private" && (await markPackPending(id))) || readBuiltPool(updated);
  if (!parsed) return refuse(404, "not_found", NOT_FOUND);
  await recordFor(caller, id, visibilityActivity(visibility));
  return { ok: true, value: { pool: await viewOf(parsed, caller), packRemoval } };
};

/** A pool on the account page. */
export type PoolListItem = Pick<StoredBuiltPool, "name" | "visibility" | "updatedAt"> & {
  id: string;
  maps: number;
};

/** The pools a user owns and edits. */
export type YourPools = { owned: PoolListItem[]; editing: PoolListItem[] };

const listItem = (pool: StoredBuiltPool): PoolListItem => ({
  id: pool._id,
  name: pool.name,
  visibility: pool.visibility,
  updatedAt: pool.updatedAt,
  maps: pool.slots.length,
});

/**
 * @function listBuiltPoolsFor
 * @param user {Pick<SessionUser, "id" | "osuId">} the signed-in user
 * @returns {Promise<YourPools>} the pools they own and the ones they edit, newest change first
 *          (rows of the wrong shape are left out)
 */
export const listBuiltPoolsFor = async (
  user: Pick<SessionUser, "id" | "osuId">,
): Promise<YourPools> => {
  const pools = await builtPoolsCollection();
  const read = async (filter: Record<string, unknown>) =>
    (await pools.find(filter).sort({ updatedAt: -1 }).limit(MAX_POOLS_PER_OWNER).toArray())
      .map(readBuiltPool)
      .flatMap((pool) => (pool ? [listItem(pool)] : []));
  const [owned, editing] = await Promise.all([
    read({ ownerId: user.id }),
    read({ "editors.osuId": user.osuId }),
  ]);
  return { owned, editing };
};
