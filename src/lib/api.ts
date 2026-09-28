/**
 * @file src/lib/api.ts
 * @desc pools' wiring for @haruhimemoe/next-kit/server's route helpers: the same-origin guard
 *       every cookie-authenticated write runs, bound to the site's URL and name, and the /check
 *       ids parser (1 to MAX_CHECK_IDS valid beatmap ids). Routes import jsonError, noStore and
 *       parseJsonBody from @haruhimemoe/next-kit/server directly.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  crossSiteMessage,
  parseIdList,
  refuseCrossSite as refuseForeign,
} from "@haruhimemoe/next-kit/server";
import { beatmapIdSchema } from "@haruhimemoe/pool";
import { MAX_CHECK_IDS } from "@/constants/compliance";
import { SITE } from "@/constants/site";

/** The 403 message refuseCrossSite sends. */
export const CROSS_SITE_REFUSED = crossSiteMessage(SITE.title);

/**
 * @function refuseCrossSite
 * @param request {Request} a cookie-authenticated write
 * @returns {Response | null} 403 when Origin is present and isn't this request's own origin or
 *          the site's, or when Sec-Fetch-Site says cross-site or same-site (packs.haruhime.moe is
 *          another site for us); otherwise null
 */
export const refuseCrossSite = (request: Request): Response | null =>
  refuseForeign(request, { siteUrl: SITE.url, siteTitle: SITE.title });

/** The 400 message for a bad ?ids= on /api/check. */
export const BAD_CHECK_IDS = `Pass 1 to ${MAX_CHECK_IDS} beatmap IDs as ?ids=1,2,3.`;

/**
 * @function parseBeatmapIds
 * @param raw {string | null} the `ids` query value, comma-separated
 * @returns {number[] | null} 1 to MAX_CHECK_IDS valid beatmap ids as sent, or null
 */
export const parseBeatmapIds = (raw: string | null): number[] | null =>
  parseIdList(raw, {
    max: MAX_CHECK_IDS,
    isValid: (id) => beatmapIdSchema.safeParse(id).success,
  });
