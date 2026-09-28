/**
 * @file src/lib/rate-limit.ts
 * @desc Fixed-window rate limits in MongoDB (collection rate_limits): one document per
 *       scope/subject/window, bumped with a single findOneAndUpdate upsert $inc, removed by the
 *       TTL index on expiresAt a minute after its window ends. The osu! budget (the check) shares
 *       the collection and the document shape. A hit can cost more than one (a call carrying
 *       several ops counts each). Subjects are IP subjects or, for signed-in writes, "user:<id>".
 *       Counting fails open: if the write fails, the request is allowed and the error logged.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import type { Db } from "mongodb";
import type { RateLimitRule } from "@/constants/api";
import { RATE_LIMITS_COLLECTION } from "@/constants/db";
import { jsonError } from "@/lib/api";
import { connectedDb } from "@/lib/db";

/** MongoDB's TTL monitor runs about once a minute; the grace keeps a live window's counter. */
const GRACE_MS = 60_000;

type Counter = { _id: string; count: number; expiresAt: Date };

const isDuplicateKey = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
};

/**
 * @function windowFor
 * @param rule {RateLimitRule} the limit
 * @param nowMs {number} current time (ms)
 * @returns the window holding nowMs; resetSeconds is 1 to windowSeconds
 */
export const windowFor = (rule: RateLimitRule, nowMs: number) => {
  const size = rule.windowSeconds * 1000;
  const start = Math.floor(nowMs / size) * size;
  const end = start + size;
  return {
    start,
    end,
    resetSeconds: Math.ceil((end - nowMs) / 1000),
    expiresAt: new Date(end + GRACE_MS),
  };
};

/**
 * @function rateLimitId
 * @param rule {RateLimitRule} the limit
 * @param subject {string} an IP subject
 * @param nowMs {number} current time (ms)
 * @returns {string} "{scope}:{subject}:{windowStartSeconds}"
 */
export const rateLimitId = (rule: RateLimitRule, subject: string, nowMs: number): string =>
  `${rule.scope}:${subject}:${windowFor(rule, nowMs).start / 1000}`;

/**
 * @function hitRateLimit
 * @param rule {RateLimitRule} the limit
 * @param subject {string} an IP or user subject
 * @param now {Date} current time (tests)
 * @param db {() => Promise<Db>} the database (tests)
 * @param cost {number} how much this hit counts (default 1)
 * @returns {Promise<RateLimitResult>} this hit counted; allowed while count <= limit (allowed with
 *          the full limit left when counting fails)
 */
export const hitRateLimit = async (
  rule: RateLimitRule,
  subject: string,
  now: Date = new Date(),
  db: () => Promise<Db> = connectedDb,
  cost = 1,
): Promise<RateLimitResult> => {
  const window = windowFor(rule, now.getTime());
  const base = { limit: rule.limit, resetSeconds: window.resetSeconds };
  try {
    const collection = (await db()).collection<Counter>(RATE_LIMITS_COLLECTION);
    const bump = () =>
      collection.findOneAndUpdate(
        { _id: rateLimitId(rule, subject, now.getTime()) },
        { $inc: { count: cost }, $setOnInsert: { expiresAt: window.expiresAt } },
        { upsert: true, returnDocument: "after" },
      );
    // Two first hits in a window can race to insert; the loser's retry finds the document.
    const doc = await bump().catch((error: unknown) => {
      if (!isDuplicateKey(error)) throw error;
      return bump();
    });
    const count = doc?.count ?? cost;
    return { ...base, allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count) };
  } catch (error) {
    console.error(`rate limit: couldn't count ${rule.scope}`, error);
    return { ...base, allowed: true, remaining: rule.limit };
  }
};

/**
 * @function rateLimitHeaders
 * @param result {RateLimitResult} a counted hit
 * @returns {Record<string, string>} RateLimit-Limit/Remaining/Reset, plus Retry-After when refused
 */
export const rateLimitHeaders = (result: RateLimitResult): Record<string, string> => ({
  "RateLimit-Limit": String(result.limit),
  "RateLimit-Remaining": String(result.remaining),
  "RateLimit-Reset": String(result.resetSeconds),
  ...(result.allowed ? {} : { "Retry-After": String(result.resetSeconds) }),
});

/**
 * @function withHeaders
 * @param response {Response} a response with mutable headers
 * @param headers {Record<string, string>} headers to set
 * @returns {Response} the same response
 */
export const withHeaders = (response: Response, headers: Record<string, string>): Response => {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
};

/**
 * @function retryText
 * @param seconds {number} wait time
 * @returns {string} "45 seconds", "1 minute", "30 minutes"
 */
export const retryText = (seconds: number): string => {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

/**
 * @function tooManyRequests
 * @param result {RateLimitResult} a refused hit
 * @returns {Response} 429 rate_limited with every rate-limit header
 */
export const tooManyRequests = (result: RateLimitResult): Response =>
  withHeaders(
    jsonError(429, `Too many requests. Try again in ${retryText(result.resetSeconds)}.`),
    rateLimitHeaders(result),
  );

/**
 * @function refuseOverLimit
 * @param rule {RateLimitRule} the limit
 * @param subject {string} an IP or user subject
 * @param cost {number} how much this hit counts (default 1)
 * @returns {Promise<Response | null>} counts this hit; a 429 (Retry-After, no-store) when it's over
 *          the limit, otherwise null
 */
export const refuseOverLimit = async (
  rule: RateLimitRule,
  subject: string,
  cost = 1,
): Promise<Response | null> => {
  const result = await hitRateLimit(rule, subject, new Date(), connectedDb, cost);
  if (result.allowed) return null;
  return withHeaders(tooManyRequests(result), { "Cache-Control": "no-store" });
};
