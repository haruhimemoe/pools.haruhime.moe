/**
 * @file src/lib/auth-session.ts
 * @desc Admin session helpers for server pages (they read next/headers). Route handlers use
 *       getAdminFromHeaders(request.headers) instead. Public pages never call these.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type AdminUser, getAdminFromHeaders } from "@/lib/auth";
import { signInHref } from "@/utils/safe-next";

/**
 * @function getCurrentAdmin
 * @returns {Promise<AdminUser | null>} the signed-in admin for this request, or null
 */
export const getCurrentAdmin = async (): Promise<AdminUser | null> =>
  getAdminFromHeaders(await headers());

/**
 * @function requireAdmin
 * @param next {string} where sign-in should return to (the page asking)
 * @returns {Promise<AdminUser>} the admin; redirects to /signin?next= when there is none
 */
export const requireAdmin = async (next = "/admin"): Promise<AdminUser> => {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(signInHref(next));
  return admin;
};
