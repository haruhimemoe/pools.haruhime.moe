/**
 * @file src/services/account.ts
 * @desc Deleting an account. First the pools: each pool they own goes, its pack on packs deleted
 *       before it (when packs can't confirm that, the deletion stops there with a 502 and the
 *       account stays, so it can be tried again), then they're taken off every pool they edit.
 *       Then every session (so no cookie works again), every linked osu! account row, and the
 *       user last, so a failure partway leaves someone who can sign in and try again. Sessions,
 *       accounts and the user go through better-auth's own adapter, which knows how it stores
 *       ids.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { getAuth, type SessionUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { type Answer, removePackOf } from "@/services/built-pools";

/**
 * @function removeUserFromBuiltPools
 * @param user {Pick<SessionUser, "id" | "osuId">} the user leaving
 * @returns {Promise<Answer<null>>} ok once they own no pool and edit none; the refusal of the
 *          first pack packs couldn't remove (that pool and the rest stay)
 */
export const removeUserFromBuiltPools = async (
  user: Pick<SessionUser, "id" | "osuId">,
): Promise<Answer<null>> => {
  const pools = await builtPoolsCollection();
  const owned = await pools
    .find({ ownerId: user.id }, { projection: { _id: 1, pack: 1 } })
    .toArray();
  for (const pool of owned) {
    const removed = await removePackOf(pool);
    if (!removed.ok) return removed;
    await pools.deleteOne({ _id: pool._id });
  }
  await pools.updateMany(
    { "editors.osuId": user.osuId },
    {
      $pull: { editors: { osuId: user.osuId } },
      $set: { updatedAt: new Date() },
      $inc: { version: 1 },
    },
  );
  return { ok: true, value: null };
};

/**
 * @function deleteAccount
 * @param user {Pick<SessionUser, "id" | "osuId">} the user, as better-auth hands out their id
 * @returns {Promise<Answer<null>>} ok once their pools, sessions, accounts and user are gone; a
 *          502 refusal when packs couldn't remove one of their pools' packs (nothing of the
 *          account is deleted then)
 * @throws when a delete fails (the database)
 */
export const deleteAccount = async (
  user: Pick<SessionUser, "id" | "osuId">,
): Promise<Answer<null>> => {
  await connectDb();
  const pools = await removeUserFromBuiltPools(user);
  if (!pools.ok) return pools;
  const { internalAdapter } = await getAuth().$context;
  await internalAdapter.deleteUserSessions(user.id);
  await internalAdapter.deleteAccounts(user.id);
  await internalAdapter.deleteUser(user.id);
  return { ok: true, value: null };
};
