/**
 * @file src/lib/auth.ts
 * @desc better-auth for admins only, built on first use: MongoDB adapter on the shared client,
 *       osu! generic OAuth (identify + public, PKCE, pools' own osu! app). The user hook refuses
 *       any osu! id not in ADMIN_OSU_IDS, so nobody else gets a user row; the session hook checks
 *       again, so an id removed from the list can't start a session; and getAdminFromHeaders
 *       reads a session whose id is no longer listed as signed out. osu! tokens are never kept.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { OSU_OAUTH, OSU_SIGN_IN_SCOPES, toOsuUser } from "@haruhimemoe/osu/shapes";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { genericOAuth } from "better-auth/plugins";
import { OSU_PROVIDER_ID } from "@/constants/auth";
import { getServerEnv } from "@/env";
import { isAdminOsuId, isAdminUserId } from "@/lib/admin";
import { connectDb, getDb, getMongoClient } from "@/lib/db";

/**
 * @function osuProfileToUser
 * @param raw {unknown} the /api/v2/me profile better-auth fetched
 * @returns the better-auth user fields (a synthetic email: osu! gives none)
 * @throws {z.ZodError} when the profile has no id or username
 */
export const osuProfileToUser = (raw: unknown) => {
  const user = toOsuUser(raw);
  return {
    email: `${user.osuId}@osu.local`,
    emailVerified: false as const,
    name: user.username,
    ...user,
    ...(user.avatarUrl ? { image: user.avatarUrl } : {}),
  };
};

/**
 * @function refuseNonAdminUser
 * @param user {Record<string, unknown>} the user better-auth is about to create (from
 *        osuProfileToUser)
 * @returns {false | undefined} false (refuse) unless its osu! id is an admin's
 */
export const refuseNonAdminUser = (user: Record<string, unknown>): false | undefined =>
  isAdminOsuId(user.osuId) ? undefined : false;

/** Drops OAuth tokens from an account write. */
const withoutTokens = <T extends Record<string, unknown>>(account: T): T => ({
  ...account,
  accessToken: null,
  refreshToken: null,
  idToken: null,
});

const createAuth = () => {
  const env = getServerEnv();
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(getDb(), { client: getMongoClient(), transaction: false }),
    // Identity only ever comes from osu!.
    disabledPaths: ["/update-user"],
    user: {
      additionalFields: {
        osuId: { type: "number", required: true },
        username: { type: "string", required: true },
        avatarUrl: { type: "string", required: false },
        countryCode: { type: "string", required: false },
      },
    },
    databaseHooks: {
      user: {
        create: { before: async (user) => refuseNonAdminUser(user as Record<string, unknown>) },
      },
      account: {
        create: { before: async (account) => ({ data: withoutTokens(account) }) },
        update: { before: async (account) => ({ data: withoutTokens(account) }) },
      },
      session: {
        create: {
          before: async (session) => ((await isAdminUserId(session.userId)) ? undefined : false),
        },
      },
    },
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: OSU_PROVIDER_ID,
            clientId: env.OSU_CLIENT_ID,
            clientSecret: env.OSU_CLIENT_SECRET,
            ...OSU_OAUTH,
            scopes: [...OSU_SIGN_IN_SCOPES],
            pkce: true,
            overrideUserInfo: true,
            mapProfileToUser: osuProfileToUser,
          },
        ],
      }),
    ],
  });
};

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | null = null;

/**
 * @function getAuth
 * @returns {Auth} the better-auth instance (built on first call)
 * @throws {EnvError} when server env is missing
 */
export const getAuth = (): Auth => {
  instance ??= createAuth();
  return instance;
};

export type AdminUser = { id: string; osuId: number; username: string; avatarUrl: string | null };

/**
 * @function getAdminFromHeaders
 * @param headers {Headers} request headers (the session cookie)
 * @returns {Promise<AdminUser | null>} the signed-in admin, or null (no, forged or expired
 *          session, or one whose osu! id isn't listed any more)
 */
export const getAdminFromHeaders = async (headers: Headers): Promise<AdminUser | null> => {
  await connectDb();
  const session = await getAuth().api.getSession({ headers });
  if (!session || !isAdminOsuId(session.user.osuId)) return null;
  const { id, osuId, username, avatarUrl } = session.user;
  return { id, osuId, username, avatarUrl: avatarUrl ?? null };
};
