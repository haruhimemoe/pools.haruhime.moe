/**
 * @file src/lib/admin.ts
 * @desc Who is admin: osu! user ids listed in ADMIN_OSU_IDS, read on every call, so removing one
 *       takes effect at the next request. A malformed list fails closed (nobody is admin) and is
 *       logged by name.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { EnvError } from "@haruhimemoe/next-kit/env";
import { getAdminOsuIds } from "@/env";

/**
 * @function isAdminOsuId
 * @param osuId {unknown} an osu! user id
 * @returns {boolean} true when ADMIN_OSU_IDS lists it
 */
export const isAdminOsuId = (osuId: unknown): boolean => {
  if (typeof osuId !== "number") return false;
  try {
    return getAdminOsuIds().has(osuId);
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    console.error(`[auth] ${error.message}`);
    return false;
  }
};
