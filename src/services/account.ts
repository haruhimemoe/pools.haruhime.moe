/**
 * @file src/services/account.ts
 * @desc Deleting an account, which a packs outage never blocks. First the API key (so no API
 *       call acts for the account meanwhile), then the pools: each pool they
 *       own goes, its pack on packs removed, or the removal queued when packs can't be asked
 *       (after the first failure the rest are queued without asking, so a packs outage can't
 *       hold the request past its time), then they're taken off every pool they edit (whose
 *       packs are marked pending, since their name leaves the description, and whose candidates
 *       lose their votes and "added by"), then a pool handed
 *       to them meanwhile goes too, so no pool is left owned by a deleted account. A pool they
 *       owned has its history deleted with it; one they only edited keeps its history, with
 *       their saves renamed to "deleted user". Then every session (so no cookie works again),
 *       every linked osu! account row, and the user last. A failure partway leaves a user row
 *       that the next osu! sign-in relinks (src/lib/auth.ts), so they can sign in and try again.
 *       Sessions, accounts and the user go through better-auth's own adapter, which knows how it
 *       stores ids. Last, the user's API rate-limit counters (api, api-write, key-create).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import { DELETED_USER } from "@/constants/activity";
import { RATE_LIMITS } from "@/constants/api";
import { apiKeys } from "@/lib/api-keys";
import { getAuth } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { poolRevisions } from "@/lib/pool-revisions";
import { limiter } from "@/lib/rate-limit";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { SlotCandidates } from "@/schemas/built-candidates";
import type { SessionUser } from "@/schemas/session-user";
import { deleteActivityOf, forgetActivityBy } from "@/services/built-pool-activity";
import { WANTS_PACK_SYNC } from "@/services/built-pools";
import { removePackOrQueue } from "@/services/pack-cleanup";
import { forgetPerson } from "@/utils/candidate-view";

/** Why the rest of an account's pack removals were queued without asking packs. */
const PACKS_FAILED_EARLIER = "packs didn't answer for an earlier pool of this account.";

/** Rounds of the owned-pools pass: a handover can land between the read and the $pull. */
const OWNED_ROUNDS = 3;

/** Their votes and "added by" leave the candidates of the pools they edit. */
const forgetCandidatesBy = async (osuId: number): Promise<void> => {
  const pools = await builtPoolsCollection();
  const edited = await pools
    .find({ "editors.osuId": osuId, candidates: { $exists: true } })
    .project<{ _id: string; version: number; candidates: SlotCandidates }>({
      candidates: 1,
      version: 1,
    })
    .toArray();
  for (const pool of edited) {
    const candidates = forgetPerson(pool.candidates, osuId);
    // Guarded by version: a change that lands meanwhile keeps its own copy.
    await pools.updateOne({ _id: pool._id, version: pool.version }, { $set: { candidates } });
  }
};

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
  let packRemovalsQueued = 0;
  const removeOwned = async () => {
    const owned = await pools
      .find({ ownerId: user.id }, { projection: { _id: 1, pack: 1 } })
      .toArray();
    for (const pool of owned) {
      const skip = packRemovalsQueued > 0 ? PACKS_FAILED_EARLIER : null;
      if ((await removePackOrQueue(pool, now, skip)) === "queued") packRemovalsQueued += 1;
      await pools.deleteOne({ _id: pool._id });
      await deleteActivityOf([pool._id]);
      await poolRevisions.removeDoc(pool._id);
    }
  };
  await removeOwned();
  // Their name leaves those pools' pack descriptions: the next sync sends them.
  await pools.updateMany(
    { "editors.osuId": user.osuId, ...WANTS_PACK_SYNC },
    { $set: { "pack.state": "pending" } },
  );
  await forgetCandidatesBy(user.osuId);
  await pools.updateMany(
    { "editors.osuId": user.osuId },
    {
      $pull: { editors: { osuId: user.osuId } },
      $set: { updatedAt: now },
      $inc: { version: 1 },
    },
  );
  // A pool handed to them after the first read, when they were still its editor, goes too.
  for (let round = 1; round < OWNED_ROUNDS; round++) {
    if ((await pools.countDocuments({ ownerId: user.id })) === 0) break;
    await removeOwned();
  }
  // Their entries on other pools' activity logs lose their name.
  await forgetActivityBy(user.osuId);
  // Their saves on pools they edit, not owned, show "deleted user" in that pool's history.
  await poolRevisions.renameAuthor(user.id, DELETED_USER);
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
  // The API key goes first, so no API call can act for the account while it is deleted.
  await apiKeys.deleteFor(user.id);
  const pools = await removeUserFromBuiltPools(user);
  const { internalAdapter } = await getAuth().$context;
  await internalAdapter.deleteUserSessions(user.id);
  await internalAdapter.deleteAccounts(user.id);
  await internalAdapter.deleteUser(user.id);
  await limiter.deleteSubject(
    [RATE_LIMITS.api, RATE_LIMITS.apiWrite, RATE_LIMITS.keyCreate],
    user.id,
  );
  return pools;
};
