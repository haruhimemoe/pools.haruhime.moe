/**
 * @file src/lib/auth-session.ts
 * @desc Session helpers for server pages (they read next/headers). Route handlers use
 *       getUserFromHeaders(request.headers) instead. Public pages never call these. A page for
 *       signed-in people sends a visitor to the hub's osu! sign-in and back here; an admin page does
 *       the same for a visitor, and answers 404 to a signed-in user who isn't an admin.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { hubSignInUrl, safeNextPath } from "@haruhimemoe/next-kit/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DEFAULT_AFTER_SIGN_IN, HUB_SIGN_IN_PATH, SITE } from "@/constants/site";
import { getHubUrl } from "@/env";
import { getUserFromHeaders } from "@/lib/auth";
import type { AdminUser, SessionUser } from "@/schemas/session-user";

/**
 * @function hubSignInHref
 * @param next {string | null | undefined} a pools path to land on after signing in (unsafe or
 *        missing: DEFAULT_AFTER_SIGN_IN)
 * @returns {string} the hub's osu! sign-in route (HUB_SIGN_IN_PATH, which goes straight to
 *          osu!), coming back to that path on pools.haruhime.moe (checked against pools' host)
 */
export const hubSignInHref = (next: string | null | undefined): string => {
  const path = safeNextPath(next, { fallback: DEFAULT_AFTER_SIGN_IN });
  return hubSignInUrl(new URL(path, SITE.url).href, {
    hubUrl: getHubUrl(),
    hosts: [new URL(SITE.url).hostname],
    signInPath: HUB_SIGN_IN_PATH,
  });
};

/**
 * @function getCurrentUser
 * @returns {Promise<SessionUser | null>} the signed-in user for this request, or null
 */
export const getCurrentUser = async (): Promise<SessionUser | null> =>
  getUserFromHeaders(await headers());

/**
 * @function requireUser
 * @param next {string} where sign-in should return to (the page asking)
 * @returns {Promise<SessionUser>} the user; redirects to the hub's sign-in when there is none
 */
export const requireUser = async (next: string): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user) redirect(hubSignInHref(next));
  return user;
};

/**
 * @function requireAdmin
 * @param next {string} where sign-in should return to (the page asking)
 * @returns {Promise<AdminUser>} the admin; redirects to the hub's sign-in when nobody is signed
 *          in, and 404s a signed-in user who isn't an admin
 */
export const requireAdmin = async (next = "/admin"): Promise<AdminUser> => {
  const { isAdmin, ...user } = await requireUser(next);
  if (!isAdmin) notFound();
  return user;
};
