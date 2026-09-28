/**
 * @file src/services/account.ts
 * @desc Deleting an account, which a packs outage never blocks. First the pools: each pool they
 *       own goes, its pack on packs removed, or the removal queued when packs can't be asked
 *       (after the first failure the rest are queued without asking, so a packs outage can't
 *       hold the request past its time), then they're taken off every pool they edit. Then
 *       every session (so no cookie works again), every linked osu! account row, and the user
 *       last. A failure partway leaves a user row that the next osu! sign-in relinks
 *       (src/lib/auth.ts), so they can sign in and try again. Sessions, accounts and the user go
 *       through better-auth's own adapter, which knows how it stores ids.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { getAuth, type SessionUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { removePackOrQueue } from "@/services/pack-cleanup";

/** Why the rest of an account's pack removals were queued without asking packs. */
const PACKS_FAILED_EARLIER = "packs didn't answer for an earlier pool of this account.";

/**
 * @function removeUserFromBuiltPools
 * @param user {Pick<SessionUser, "id" | "osuId">} the user leaving
 * @param now {Date} current time (tests)
 * @returns {Promise<{ packRemovalsQueued: number }>} once they own no pool and edit none: how
 *          many of their pools' packs wait in pack_cleanup
 */
export const removeUserFromBuiltPools = async (
  user: Pick<SessionUser, "id" | "osuId">,
  now: Date = new Date(),
): Promise<{ packRemovalsQueued: number }> => {
  const pools = await builtPoolsCollection();
  const owned = await pools
    .find({ ownerId: user.id }, { projection: { _id: 1, pack: 1 } })
    .toArray();
  let packRemovalsQueued = 0;
  for (const pool of owned) {
    const skip = packRemovalsQueued > 0 ? PACKS_FAILED_EARLIER : null;
    if ((await removePackOrQueue(pool, now, skip)) === "queued") packRemovalsQueued += 1;
    await pools.deleteOne({ _id: pool._id });
  }
  await pools.updateMany(
    { "editors.osuId": user.osuId },
    {
      $pull: { editors: { osuId: user.osuId } },
      $set: { updatedAt: now },
      $inc: { version: 1 },
    },
  );
  return { packRemovalsQueued };
};

/**
 * @function deleteAccount
 * @param user {Pick<SessionUser, "id" | "osuId">} the user, as better-auth hands out their id
 * @returns {Promise<{ packRemovalsQueued: number }>} once their pools, sessions, accounts and
 *          user are gone: how many pack removals wait for packs
 * @throws when a delete fails (the database)
 */
export const deleteAccount = async (
  user: Pick<SessionUser, "id" | "osuId">,
): Promise<{ packRemovalsQueued: number }> => {
  await connectDb();
  const pools = await removeUserFromBuiltPools(user);
  const { internalAdapter } = await getAuth().$context;
  await internalAdapter.deleteUserSessions(user.id);
  await internalAdapter.deleteAccounts(user.id);
  await internalAdapter.deleteUser(user.id);
  return pools;
};
