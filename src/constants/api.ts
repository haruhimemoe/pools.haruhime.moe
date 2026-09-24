/**
 * @file src/constants/api.ts
 * @desc Per-IP rate limits on the public JSON routes. Counters live in rate_limits
 *       (src/lib/rate-limit.ts); the CDN answers repeats without counting them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

export type RateLimitRule = { scope: string; limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  /** GET /api/search, per IP. */
  search: { scope: "search", limit: 60, windowSeconds: 60 },
  /** GET /api/check, per IP (its osu! calls also count against the osu! budget). */
  check: { scope: "check", limit: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;
