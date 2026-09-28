/**
 * @file src/lib/auth.ts
 * @desc better-auth for every osu! user, built on first use by @haruhimemoe/next-kit/auth's
 *       createOsuAuth (MongoDB on the shared client, osu! OAuth with PKCE, osu! trusted for
 *       account linking, no osu! tokens kept, errors to /signin?error=<code>, and the readable
 *       SIGNED_IN_COOKIE marker following the session). Anyone with an osu! account can sign in
 *       (to make pools); admin rights come only from ADMIN_OSU_IDS, read on every request by
 *       getUserFromHeaders and getAdminFromHeaders, so a removed id stops being an admin at
 *       once. A first sign-in links the new user to the pools that already list their osu! id
 *       as an editor.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { createOsuAuth, getOsuUser, type OsuSessionUser } from "@haruhimemoe/next-kit/auth";
import { SIGNED_IN_COOKIE } from "@/constants/site";
import { getServerEnv } from "@/env";
import { isAdminOsuId } from "@/lib/admin";
import { connectDb, getDb, getMongoClient } from "@/lib/db";
import { linkEditorAccount } from "@/services/built-pool-editors";

/**
 * @function linkNewEditor
 * @param user {Record<string, unknown>} the user row better-auth just wrote
 * @returns {Promise<void>} links it to the pools that list its osu! id as an editor; a failure
 *          is logged and never fails the sign-in
 */
export const linkNewEditor = async (user: Record<string, unknown>): Promise<void> => {
  if (typeof user.osuId !== "number" || typeof user.id !== "string") return;
  try {
    await linkEditorAccount(user.osuId, user.id);
  } catch (error) {
    console.error("[auth] couldn't link a new user to the pools they edit", error);
  }
};

const createAuth = () => {
  const env = getServerEnv();
  return createOsuAuth({
    clientId: env.OSU_CLIENT_ID,
    clientSecret: env.OSU_CLIENT_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    db: getDb(),
    client: getMongoClient(),
    markerCookie: SIGNED_IN_COOKIE,
    // An owner may have added this osu! id as an editor before its first sign-in.
    hooks: { afterUserCreate: linkNewEditor },
  });
};

/** The better-auth instance's type, for the client's inferAdditionalFields. */
export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | null = null;

/**
 * @function getAuth
 * @returns {Auth} the process-wide better-auth instance, built on first use
 */
export const getAuth = (): Auth => {
  instance ??= createAuth();
  return instance;
};

/** The signed-in user, and whether ADMIN_OSU_IDS lists them right now. */
export type SessionUser = OsuSessionUser & { isAdmin: boolean };

/** A signed-in admin. */
export type AdminUser = OsuSessionUser;

/**
 * @function getUserFromHeaders
 * @param headers {Headers} request headers (the session cookie)
 * @returns {Promise<SessionUser | null>} the signed-in user, or null
 */
export const getUserFromHeaders = async (headers: Headers): Promise<SessionUser | null> => {
  await connectDb();
  const user = await getOsuUser(getAuth(), headers);
  return user ? { ...user, isAdmin: isAdminOsuId(user.osuId) } : null;
};

/**
 * @function getAdminFromHeaders
 * @param headers {Headers} request headers
 * @returns {Promise<AdminUser | null>} the signed-in admin, or null (signed out, or signed in
 *          without an id in ADMIN_OSU_IDS)
 */
export const getAdminFromHeaders = async (headers: Headers): Promise<AdminUser | null> => {
  const user = await getUserFromHeaders(headers);
  if (!user?.isAdmin) return null;
  const { isAdmin: _, ...admin } = user;
  return admin;
};
