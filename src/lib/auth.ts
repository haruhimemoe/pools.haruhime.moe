/**
 * @file src/lib/auth.ts
 * @desc Who a request comes from, read from the haruhime.moe hub's session. The hub is the only
 *       app that runs osu! sign-in; pools reads its `better-auth.session_token` cookie (on
 *       .haruhime.moe) with next-kit's createSessionReader: the signature checked against the
 *       shared BETTER_AUTH_SECRET, then the session and user read from the identity database,
 *       with zero writes (pools' Atlas user can only read identity). An old session pings the hub
 *       to refresh it there. A banned user reads as signed out (requireSession). Anyone with an
 *       osu! account can make pools; admin rights come only from ADMIN_OSU_IDS, read on every
 *       request, so a removed id stops being an admin at once. Editors added before they ever
 *       signed in are found by osu! id in identity when they're needed (built-pool-editors.ts),
 *       so there's no first-sign-in hook to run here.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import {
  createSessionReader,
  requireSession,
  type SessionReaderInstance,
} from "@haruhimemoe/next-kit/auth";
import { getHubUrl, getServerEnv } from "@/env";
import { isAdminOsuId } from "@/lib/admin";
import { connectDb, getIdentityDb } from "@/lib/db";
import type { AdminUser, SessionUser } from "@/schemas/session-user";

let reader: SessionReaderInstance | null = null;

/**
 * @function getSessionReader
 * @returns {SessionReaderInstance} the process-wide reader of the hub's session, built on first
 *          use (not at import, so builds need no env)
 */
export const getSessionReader = (): SessionReaderInstance => {
  reader ??= createSessionReader({
    identityDb: getIdentityDb(),
    secret: getServerEnv().BETTER_AUTH_SECRET,
    hubUrl: getHubUrl(),
  });
  return reader;
};

/**
 * @function getUserFromHeaders
 * @param headers {Headers} request headers (the hub's session cookie)
 * @returns {Promise<SessionUser | null>} the signed-in, unbanned user, or null
 */
export const getUserFromHeaders = async (headers: Headers): Promise<SessionUser | null> => {
  await connectDb();
  const user = await requireSession(getSessionReader(), headers);
  return user ? { ...user, isAdmin: isAdminOsuId(user.osuId) } : null;
};

/**
 * @function getAdminFromHeaders
 * @param headers {Headers} request headers
 * @returns {Promise<AdminUser | null>} the signed-in admin, or null (signed out, banned, or
 *          signed in without an id in ADMIN_OSU_IDS)
 */
export const getAdminFromHeaders = async (headers: Headers): Promise<AdminUser | null> => {
  const user = await getUserFromHeaders(headers);
  if (!user?.isAdmin) return null;
  const { isAdmin: _, ...admin } = user;
  return admin;
};
