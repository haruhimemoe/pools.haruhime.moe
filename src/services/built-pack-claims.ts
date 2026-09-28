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

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Takes the pool for one sync, or null when it's not due (or not there). A forced claim skips
 * the 30 s but not a claim younger than the PUT timeout: that sync may still be out at packs.
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
 * A forced claim: one that meets a sync still out waits until that claim is older than the PUT
 * timeout and tries once more; still busy (another claim came meanwhile), the pool is left
 * pending. Null when the pool isn't there, private or gone, or was left pending.
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

export const claimAt = async (id: string, at: Date) => {
  const pool = await claim(id, at, false);
  return pool ? { pool, at } : null;
};

export const asClaimed = (pool: StoredBuiltPool, at: Date) => ({
  _id: pool._id,
  version: pool.version,
  "pack.lastAttemptAt": at,
});

export const storeIfUnchanged = async (
  pool: StoredBuiltPool,
  at: Date,
  pack: StoredBuiltPool["pack"],
) =>
  (await (await builtPoolsCollection()).updateOne(asClaimed(pool, at), { $set: { pack } }))
    .matchedCount === 1;
