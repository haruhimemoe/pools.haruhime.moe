/**
 * @file src/lib/auth.ts
 * @desc better-auth for every osu! user, built on first use: MongoDB adapter on the shared
 *       client, osu! generic OAuth (identify + public, PKCE, pools' own osu! app). Anyone with an
 *       osu! account can sign in (to make pools); admin rights come only from ADMIN_OSU_IDS,
 *       read on every request by getUserFromHeaders and getAdminFromHeaders, so a removed id
 *       stops being an admin at once. osu! tokens are never kept. A readable signed-in marker
 *       cookie follows the session (set with it, cleared on sign-out or a get-session that finds
 *       none), so pages ask for the session only when it's there. Errors with no page to return
 *       to go to /signin?error=<code>.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { OSU_OAUTH, OSU_SIGN_IN_SCOPES, toOsuUser } from "@haruhimemoe/osu/shapes";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { createAuthMiddleware } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import { OSU_PROVIDER_ID } from "@/constants/auth";
import { getServerEnv } from "@/env";
import { isAdminOsuId } from "@/lib/admin";
import { connectDb, getDb, getMongoClient } from "@/lib/db";
import { markerMaxAge, SIGNED_IN_COOKIE } from "@/lib/signed-in-marker";

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

/** Drops OAuth tokens from an account write. */
const withoutTokens = <T extends Record<string, unknown>>(account: T): T => ({
  ...account,
  accessToken: null,
  refreshToken: null,
  idToken: null,
});

const createAuth = () => {
  const env = getServerEnv();
  const markerOptions = {
    path: "/",
    sameSite: "lax" as const,
    secure: env.BETTER_AUTH_URL.startsWith("https://"),
    httpOnly: false,
  };
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(getDb(), { client: getMongoClient(), transaction: false }),
    // Identity only ever comes from osu!.
    disabledPaths: ["/update-user"],
    // A failure with no page to return to (a callback whose state can't be read) lands on
    // /signin?error=<code>, which explains it, instead of better-auth's bare error page.
    onAPIError: { errorURL: new URL("/signin", env.BETTER_AUTH_URL).toString() },
    user: {
      additionalFields: {
        osuId: { type: "number", required: true },
        username: { type: "string", required: true },
        avatarUrl: { type: "string", required: false },
        countryCode: { type: "string", required: false },
      },
    },
    databaseHooks: {
      account: {
        create: { before: async (account) => ({ data: withoutTokens(account) }) },
        update: { before: async (account) => ({ data: withoutTokens(account) }) },
      },
    },
    hooks: {
      // Keep the readable "signed in" marker in step with the session, so pages without it never
      // ask for the session at all (src/hooks/useAccount.ts).
      after: createAuthMiddleware(async (ctx) => {
        const set = (expiresAt: Date | string) =>
          ctx.setCookie(SIGNED_IN_COOKIE, "1", {
            ...markerOptions,
            maxAge: markerMaxAge(expiresAt),
          });
        const clear = () => ctx.setCookie(SIGNED_IN_COOKIE, "", { ...markerOptions, maxAge: 0 });
        const created = ctx.context.newSession;
        if (created) {
          set(created.session.expiresAt);
        } else if (ctx.path === "/sign-out") {
          clear();
        } else if (ctx.path === "/get-session") {
          const returned = ctx.context.returned as {
            session?: { expiresAt: Date | string };
          } | null;
          if (returned?.session) set(returned.session.expiresAt);
          else clear();
        }
      }),
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

export type SessionUser = {
  id: string;
  osuId: number;
  username: string;
  avatarUrl: string | null;
  /** ADMIN_OSU_IDS lists their osu! id, read for this request. */
  isAdmin: boolean;
};

export type AdminUser = Omit<SessionUser, "isAdmin">;

/**
 * @function getUserFromHeaders
 * @param headers {Headers} request headers (the session cookie)
 * @returns {Promise<SessionUser | null>} the signed-in user, or null (no, forged or expired
 *          session)
 */
export const getUserFromHeaders = async (headers: Headers): Promise<SessionUser | null> => {
  await connectDb();
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;
  const { id, osuId, username, avatarUrl } = session.user;
  return { id, osuId, username, avatarUrl: avatarUrl ?? null, isAdmin: isAdminOsuId(osuId) };
};

/**
 * @function getAdminFromHeaders
 * @param headers {Headers} request headers (the session cookie)
 * @returns {Promise<AdminUser | null>} the signed-in admin, or null (no, forged or expired
 *          session, or one whose osu! id isn't listed, or isn't any more)
 */
export const getAdminFromHeaders = async (headers: Headers): Promise<AdminUser | null> => {
  const user = await getUserFromHeaders(headers);
  if (!user?.isAdmin) return null;
  const { isAdmin: _, ...admin } = user;
  return admin;
};
