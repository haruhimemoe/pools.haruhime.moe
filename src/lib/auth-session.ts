/**
 * @file src/lib/auth-session.ts
 * @desc Session helpers for server pages (they read next/headers). Route handlers use
 *       getUserFromHeaders(request.headers) instead. Public pages never call these. A page for
 *       signed-in people sends a visitor to sign in and back; an admin page does the same for a
 *       visitor, and answers 404 to a signed-in user who isn't an admin.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { signInHref } from "@haruhimemoe/next-kit/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { type AdminUser, getUserFromHeaders, type SessionUser } from "@/lib/auth";

/**
 * @function getCurrentUser
 * @returns {Promise<SessionUser | null>} the signed-in user for this request, or null
 */
export const getCurrentUser = async (): Promise<SessionUser | null> =>
  getUserFromHeaders(await headers());

/**
 * @function requireUser
 * @param next {string} where sign-in should return to (the page asking)
 * @returns {Promise<SessionUser>} the user; redirects to /signin?next= when there is none
 */
export const requireUser = async (next: string): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user) redirect(signInHref(next));
  return user;
};

/**
 * @function requireAdmin
 * @param next {string} where sign-in should return to (the page asking)
 * @returns {Promise<AdminUser>} the admin; redirects to /signin?next= when nobody is signed in,
 *          and 404s a signed-in user who isn't an admin
 */
export const requireAdmin = async (next = "/admin"): Promise<AdminUser> => {
  const { isAdmin, ...user } = await requireUser(next);
  if (!isAdmin) notFound();
  return user;
};
