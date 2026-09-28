/**
 * @file src/services/built-pack-claims.ts
 * @desc How a built pool's pack sync claims the pool and stores what packs answered: one guarded
 *       write stamps pack.lastAttemptAt (at most once every 30 s, or at once for a forced sync
 *       that waits out a claim younger than the PUT timeout), and every write after the PUT
 *       holds to that claim, so an answer is stored only when the version didn't move and no
 *       newer sync claimed the pool.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { PACKS_TIMEOUT_MS } from "@/lib/packs-client";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import { findBuiltPool, readBuiltPool } from "@/services/built-pool-read";
import { markPackPending } from "@/services/built-pools";
import { PACK_SYNC_INTERVAL_MS } from "@/utils/built-pack";

/**
 * @function sleep
 * @param ms {number} how long
 * @returns {Promise<void>} resolves after that long
 */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * @function claim
 * @param id {string} a built pool
 * @param at {Date} the claim's time, stamped as pack.lastAttemptAt
 * @param force {boolean} skip the 30 s (but not a claim younger than the PUT timeout: that sync
 *        may still be out at packs)
 * @returns {Promise<StoredBuiltPool | null>} the pool taken for one sync, or null when it's not
 *          due (or not there)
 */
export const claim = async (
  id: string,
  at: Date,
  force: boolean,
): Promise<StoredBuiltPool | null> => {
  const since = new Date(at.getTime() - (force ? PACKS_TIMEOUT_MS : PACK_SYNC_INTERVAL_MS));
  const free = { $or: [{ "pack.lastAttemptAt": null }, { "pack.lastAttemptAt": { $lte: since } }] };
  // A refusal waits for the next change (pending) or a forced sync.
  const waiting = {
    $or: [{ "pack.state": "pending" }, { "pack.state": "failed", "pack.retry": { $ne: false } }],
  };
  const due = force ? free : { $and: [free, waiting] };
  const row = await (await builtPoolsCollection()).findOneAndUpdate(
    { _id: id, visibility: { $ne: "private" }, "pack.gone": { $ne: true }, ...due },
    { $set: { "pack.lastAttemptAt": at } },
    { returnDocument: "after" },
  );
  return readBuiltPool(row);
};

/**
 * @function claimForced
 * @param id {string} a built pool
 * @param now {() => Date} the clock
 * @param wait {(ms: number) => Promise<void>} waits out a sync still out at packs
 * @returns {Promise<{ pool: StoredBuiltPool; at: Date } | null>} the pool and its claim; one
 *          that meets a sync still out waits until that claim is older than the PUT timeout and
 *          tries once more. Null when the pool isn't there, private or gone, or was left pending
 *          (another claim came meanwhile).
 */
export const claimForced = async (
  id: string,
  now: () => Date,
  wait: (ms: number) => Promise<void>,
): Promise<{ pool: StoredBuiltPool; at: Date } | null> => {
  for (let tries = 0; tries < 2; tries++) {
    const at = now();
    const pool = await claim(id, at, true);
    if (pool) return { pool, at };
    const current = await findBuiltPool(id);
    const last = current?.pack.lastAttemptAt;
    if (!current || !last || current.visibility === "private" || current.pack.gone) return null;
    if (tries === 0) await wait(Math.max(0, last.getTime() + PACKS_TIMEOUT_MS - at.getTime()));
  }
  await markPackPending(id);
  return null;
};

/**
 * @function claimAt
 * @param id {string} a built pool
 * @param at {Date} the claim's time
 * @returns {Promise<StoredBuiltPool | null>} a regular claim: the pool when it's due (pending, or
 *          failed and worth trying again) and 30 s past its last claim, else null
 */
export const claimAt = async (id: string, at: Date) => {
  const pool = await claim(id, at, false);
  return pool ? { pool, at } : null;
};

/**
 * @function asClaimed
 * @param pool {StoredBuiltPool} the pool as the claim read it
 * @param at {Date} the claim's time
 * @returns the filter for the pool as that claim left it: the same version, and no newer claim
 */
export const asClaimed = (pool: StoredBuiltPool, at: Date) => ({
  _id: pool._id,
  version: pool.version,
  "pack.lastAttemptAt": at,
});

/**
 * @function storeIfUnchanged
 * @param pool {StoredBuiltPool} the pool as the claim read it
 * @param at {Date} the claim's time
 * @param pack {StoredBuiltPool["pack"]} the pack to store
 * @returns {Promise<boolean>} true when stored; false when the pool changed or a newer sync
 *          claimed it
 */
export const storeIfUnchanged = async (
  pool: StoredBuiltPool,
  at: Date,
  pack: StoredBuiltPool["pack"],
) =>
  (await (await builtPoolsCollection()).updateOne(asClaimed(pool, at), { $set: { pack } }))
    .matchedCount === 1;
