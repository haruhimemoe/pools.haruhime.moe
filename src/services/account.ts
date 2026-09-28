/**
 * @file src/services/account.ts
 * @desc Deleting an account: every session (so no cookie works again), every linked osu!
 *       account row, then the user. The user goes last, so a failure partway leaves someone who
 *       can sign in and try again. Through better-auth's own adapter, which knows how it stores
 *       ids.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { getAuth } from "@/lib/auth";
import { connectDb } from "@/lib/db";

/**
 * @function deleteAccount
 * @param userId {string} the user's id, as better-auth hands it out
 * @returns {Promise<void>} resolves once the sessions, accounts and user are gone
 * @throws when a delete fails (the database)
 */
export const deleteAccount = async (userId: string): Promise<void> => {
  await connectDb();
  const { internalAdapter } = await getAuth().$context;
  await internalAdapter.deleteUserSessions(userId);
  await internalAdapter.deleteAccounts(userId);
  await internalAdapter.deleteUser(userId);
};
