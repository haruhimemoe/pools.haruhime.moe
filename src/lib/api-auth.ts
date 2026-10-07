/**
 * @file src/lib/api-auth.ts
 * @desc withApiKey(): wraps every /api/v1 handler with next-kit's api-keys guard. Reads the Bearer
 *       hpl_ key, counts failures per IP (auth-fail) and requests per user (api, api-write),
 *       answers 401 for a deleted, banned or system account (the owner read from the hub's
 *       identity database, read-only), and sends RateLimit-* and no-store headers.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { createApiKeyGuard } from "@haruhimemoe/next-kit/api-keys";
import { ObjectId } from "mongodb";
import { RATE_LIMITS } from "@/constants/api";
import { apiKeys } from "@/lib/api-keys";
import { getIdentityDb } from "@/lib/db";
import { limiter } from "@/lib/rate-limit";

/** Who an API key acts as. */
export type ApiCaller = { id: string; osuId: number; username: string };

/**
 * @function resolveCaller
 * @param userId {string} the key owner's user id
 * @returns {Promise<ApiCaller | null>} the owner, or null when the account is gone, banned or a
 *          system one
 */
const resolveCaller = async (userId: string): Promise<ApiCaller | null> => {
  if (!ObjectId.isValid(userId)) return null;
  const user = await getIdentityDb()
    .collection("user")
    .findOne(
      { _id: new ObjectId(userId) },
      { projection: { osuId: 1, username: 1, system: 1, bannedAt: 1 } },
    );
  if (!user || user.system === true || user.bannedAt) return null;
  if (typeof user.username !== "string" || typeof user.osuId !== "number") return null;
  return { id: userId, osuId: user.osuId, username: user.username };
};

/** Wraps an /api/v1 handler: key check, limits, headers, JSON 500 on a throw. */
export const withApiKey = createApiKeyGuard({
  store: apiKeys,
  limiter,
  resolveCaller,
  messages: {
    missing: "Send your API key in the Authorization header: Bearer hpl_…",
    invalid: "That API key isn't valid. It may have been revoked or replaced.",
  },
  limits: RATE_LIMITS,
});
