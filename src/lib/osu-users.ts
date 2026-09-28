/**
 * @file src/lib/osu-users.ts
 * @desc Looks an osu! user up by username, to add a pool editor who may never have signed in:
 *       @haruhimemoe/osu's getUser (GET /api/v2/users/@<name>) on the process-wide client
 *       (src/lib/osu.ts), with the caller's budget check before the call (osuBudget). Never
 *       throws; the secret is never logged.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { getOsuClient, type OsuClient } from "@/lib/osu";

/** An osu! username looked up: found, not found, or why it couldn't be. */
export type OsuUserLookup =
  | { kind: "found"; osuId: number; username: string }
  | { kind: "missing" }
  | { kind: "unavailable" };

/** The budget check before the call, and the client (tests). */
export type LookupOptions = {
  /** Asked before the user request; false means osu! isn't asked (default: always ask). */
  beforeCall?: () => Promise<boolean>;
  /** The osu! client (tests); default getOsuClient(). */
  client?: Pick<OsuClient, "getUser">;
};

/**
 * @function lookupOsuUser
 * @param username {string} an osu! username as typed (osu! matches it without case)
 * @param options {LookupOptions} the budget check and the client
 * @returns {Promise<OsuUserLookup>} the user's id and current name, missing when osu! has nobody
 *          by that name (404), or unavailable (budget refused, a failure, an unreadable answer)
 */
export const lookupOsuUser = async (
  username: string,
  { beforeCall = async () => true, client }: LookupOptions = {},
): Promise<OsuUserLookup> => {
  try {
    const user = await (client ?? getOsuClient()).getUser(username, { beforeCall });
    if (!user) return { kind: "missing" };
    return { kind: "found", osuId: user.osuId, username: user.username };
  } catch (error) {
    console.error("[osu] user lookup failed", error instanceof Error ? error.message : error);
    return { kind: "unavailable" };
  }
};
