/**
 * @file src/constants/api.ts
 * @desc Rate limits: per IP on the public JSON routes (the CDN answers repeats without counting
 *       them), and per user (by osu! id) on the pool builder's writes and account deletion.
 *       Counters live in rate_limits
 *       (src/lib/rate-limit.ts). Also the public API's key prefix (hpl_), its docs and OpenAPI
 *       paths, and next-kit's standard API limits.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Oct 3, 2026
 */

import { API_LIMITS } from "@haruhimemoe/next-kit/api-keys";

/** pools' key prefix (haruhime-app-standards registry). */
export const API_KEY_PREFIX = "hpl_";
/** The API docs page. */
export const API_DOCS_PATH = "/docs/api";
/** The OpenAPI document, the one /api path robots.txt allows. */
export const OPENAPI_PATH = "/api/v1/openapi.json";

/** A fixed-window limit: its scope, how many hits, and the window in seconds. */
export type RateLimitRule = { scope: string; limit: number; windowSeconds: number };

/** Every rate limit pools counts, per IP or per osu! account. */
export const RATE_LIMITS = {
  /** GET /api/search, per IP. */
  search: { scope: "search", limit: 60, windowSeconds: 60 },
  /** GET /api/check, per IP (its osu! calls also count against the osu! budget). */
  check: { scope: "check", limit: 30, windowSeconds: 60 },
  /** POST /api/pools/<id>/ops, per user: each op in a call counts. */
  poolOps: { scope: "pool-ops", limit: 120, windowSeconds: 60 },
  /** POST /api/pools, per user. */
  poolCreate: { scope: "pool-create", limit: 10, windowSeconds: 3600 },
  /** "Update pack now" (POST /api/pools/<id>/pack), per user. */
  packUpdate: { scope: "pack-update", limit: 20, windowSeconds: 3600 },
  /** Adding and removing editors, per user. */
  poolEditors: { scope: "pool-editors", limit: 30, windowSeconds: 3600 },
  /** DELETE /api/account, per osu! account (it outlives the account it counts). */
  accountDelete: { scope: "account-delete", limit: 3, windowSeconds: 3600 },
  /** Every /api/v1 request, per user. */
  api: API_LIMITS.api,
  /** /api/v1 writes, per user. */
  apiWrite: API_LIMITS.apiWrite,
  /** Missing, bad or revoked API keys, per IP. */
  authFail: API_LIMITS.authFail,
  /** Creating or regenerating an API key, per user. */
  keyCreate: API_LIMITS.keyCreate,
} as const satisfies Record<string, RateLimitRule>;
