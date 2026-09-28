/**
 * @file src/lib/rate-limit.ts
 * @desc pools' rate limiter: next-kit's fixed-window counters in MongoDB (collection
 *       rate_limits, removed by the TTL index a minute after each window ends), on the pools
 *       database. The osu! budget (osuBudget in src/lib/osu.ts) shares the collection and the
 *       document shape. A hit can cost more than one (a call carrying several ops counts each). Subjects
 *       are IP subjects or, for signed-in writes, next-kit's userSubject ("osu:<osuId>").
 *       Counting fails open: if the write fails, the request is allowed and the error logged.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { createRateLimiter, type RateLimiter } from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS_COLLECTION } from "@/constants/db";
import { connectedDb } from "@/lib/db";

/** The process-wide limiter on rate_limits. */
export const limiter: RateLimiter = createRateLimiter({
  db: connectedDb,
  collection: RATE_LIMITS_COLLECTION,
});

/**
 * @function refuseOverLimit
 * @param rule {RateLimitRule} the limit
 * @param subject {string} an IP subject or userSubject
 * @param cost {number} how much this hit counts (default 1)
 * @returns {Promise<Response | null>} a no-store 429 with Retry-After when it's over the limit,
 *          otherwise null
 */
export const refuseOverLimit: RateLimiter["refuseOverLimit"] = (rule, subject, cost) =>
  limiter.refuseOverLimit(rule, subject, cost);
