/**
 * @file src/constants/compliance.ts
 * @desc The check: how long beatmapset facts stay cached, the global osu! budget (every osu! call
 *       pools makes, across instances) and each IP's share of it, the compact-set fallback cap,
 *       how many maps one check takes, and how long a complete answer stays on the CDN.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

/** A beatmapset's facts are asked for again after a day (status, a DMCA, tags can change). */
export const SET_FACTS_TTL_SECONDS = 86_400;
export const SET_FACTS_TTL_INDEX = "setFacts_fetchedAt_ttl";
export const SET_FACTS_BEATMAPS_INDEX = "beatmapIds_1";

/** Our calls to osu!, across every function instance. osu! asks for about 60 a minute. */
export const OSU_API_BUDGET = {
  scope: "osu-api",
  subject: "global",
  limit: 50,
  windowSeconds: 60,
} as const;

/** Each IP's share of those calls (IPv6 by its /64). */
export const OSU_API_BUDGET_PER_IP = { scope: "osu-api-ip", limit: 20, windowSeconds: 60 } as const;

/** At most this many /beatmapsets/{id} calls for compact sets per check. */
export const FACTS_FALLBACK_LIMIT = 10;

/** A pool holds at most 64 maps. */
export const MAX_CHECK_IDS = 64;

/**
 * A complete answer: 5 minutes on the CDN, never served stale. Its map labels and usage come from
 * pools, so a pool an admin hides leaves /check within 5 minutes; the verdicts stay a day in
 * setFacts either way. A partial answer, or one whose maps lookup failed, is never cached.
 */
export const CHECK_CACHE = "public, s-maxage=300";
