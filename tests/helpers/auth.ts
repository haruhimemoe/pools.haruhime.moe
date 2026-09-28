/**
 * @file tests/helpers/auth.ts
 * @desc createTestUser(): a real better-auth user + osu! account + session in the test database,
 *       with the signed session cookie a browser would send. createTestAdmin() is the same for an
 *       osu! id that ADMIN_OSU_IDS lists (admin rights are read per request, so the test stubs
 *       the list).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { OSU_PROVIDER_ID } from "@haruhimemoe/next-kit/auth";
import { TEST_OSU_APP_ENV } from "@haruhimemoe/next-kit/testing";
import { makeSignature } from "better-auth/crypto";
import { getAuth } from "@/lib/auth";

export const ADMIN_OSU_ID = 12231334;

export type TestUser = { id: string; osuId: number; username: string; cookie: string };

/**
 * @function createTestUser
 * @param osuId {number} the user's osu! id
 * @param username {string} their osu! username (default player<osuId>)
 * @returns {Promise<TestUser>} the user's id, osu! id, username and session cookie
 */
export const createTestUser = async (
  osuId: number,
  username = `player${osuId}`,
): Promise<TestUser> => {
  const ctx = await getAuth().$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `${osuId}@osu.local`, emailVerified: false, name: username, osuId, username },
    { method: "oauth", oauth: { providerId: OSU_PROVIDER_ID } },
  );
  await ctx.internalAdapter.createAccount({
    userId: user.id,
    providerId: OSU_PROVIDER_ID,
    accountId: String(osuId),
  });
  const session = await ctx.internalAdapter.createSession(user.id, false);
  const signature = await makeSignature(session.token, TEST_OSU_APP_ENV.BETTER_AUTH_SECRET);
  const cookie = `better-auth.session_token=${encodeURIComponent(`${session.token}.${signature}`)}`;
  return { id: user.id, osuId, username, cookie };
};

/**
 * @function createTestAdmin
 * @param osuId {number} the admin's osu! id (default ADMIN_OSU_ID; ADMIN_OSU_IDS must list it)
 * @returns {Promise<TestUser>} as createTestUser, named admin<osuId>
 */
export const createTestAdmin = (osuId: number = ADMIN_OSU_ID): Promise<TestUser> =>
  createTestUser(osuId, `admin${osuId}`);
