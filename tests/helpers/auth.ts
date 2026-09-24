/**
 * @file tests/helpers/auth.ts
 * @desc createTestAdmin(): a real better-auth user + osu! account + session in the test
 *       database, with the signed session cookie a browser would send. The osu! id must be in
 *       ADMIN_OSU_IDS when it's called (the user hook refuses anyone else).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { makeSignature } from "better-auth/crypto";
import { OSU_PROVIDER_ID } from "@/constants/auth";
import { getAuth } from "@/lib/auth";
import { TEST_SERVER_ENV } from "./server-env";

export const ADMIN_OSU_ID = 12231334;

/**
 * @function createTestAdmin
 * @param osuId {number} the admin's osu! id (default ADMIN_OSU_ID)
 * @returns {Promise<{ id: string; osuId: number; username: string; cookie: string }>}
 */
export const createTestAdmin = async (
  osuId: number = ADMIN_OSU_ID,
): Promise<{ id: string; osuId: number; username: string; cookie: string }> => {
  const ctx = await getAuth().$context;
  const username = `admin${osuId}`;
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
  const signature = await makeSignature(session.token, TEST_SERVER_ENV.BETTER_AUTH_SECRET);
  const cookie = `better-auth.session_token=${encodeURIComponent(`${session.token}.${signature}`)}`;
  return { id: user.id, osuId, username, cookie };
};
