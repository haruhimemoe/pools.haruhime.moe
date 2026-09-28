/**
 * @file src/app/api/search/route.ts
 * @desc GET /api/search?tab=pools|maps&...: one page of pool or map results (the query string
 *       src/utils/search-params.ts reads and writes); the maps tab searches every osu! map
 *       through the mirror (scope all, src/services/all-maps.ts) or the maps played in pools
 *       (scope played). Counts 60 requests a minute per IP; the CDN
 *       keeps successful answers 5 minutes and never serves them stale, so repeats never reach
 *       the database or the counter and a pool an admin hides is gone within 5 minutes.
 *       Never reads a cookie. A bad "contains map" is 400; a database failure is 503; a failed
 *       mirror is 503 with the fixed sentence (so is every all-maps search while a Retry-After
 *       the mirror sent on a 429 or 503 runs, without asking it); none of them is cached, nor is
 *       an all-maps page whose played-in lookup failed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { clientIp, jsonError, noStore, rateLimitSubject } from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { ALL_MAPS_FAILED, MIRROR_UNAVAILABLE_CODE, SEARCH_CACHE } from "@/constants/search";
import { refuseOverLimit } from "@/lib/rate-limit";
import { searchAllMaps } from "@/services/all-maps";
import { searchMaps } from "@/services/search";
import { searchPools } from "@/services/search-pools";
import { parseSearchState } from "@/utils/search-params";

/**
 * @function GET
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} one page of pools or maps (CDN cached 5 minutes), or a 503 for the
 *          all-maps search
 */
export async function GET(request: Request) {
  const limited = await refuseOverLimit(
    RATE_LIMITS.search,
    rateLimitSubject(clientIp(request.headers)),
  );
  if (limited) return limited;
  const state = parseSearchState(new URL(request.url).searchParams);
  try {
    if (state.tab === "maps" && state.scope === "all") {
      const result = await searchAllMaps(state.filters, state.page);
      if (!result.ok) return noStore(jsonError(503, ALL_MAPS_FAILED, MIRROR_UNAVAILABLE_CODE));
      const body = Response.json({ tab: "maps", scope: "all", ...result.answer });
      if (!result.cacheable) return noStore(body);
      body.headers.set("Cache-Control", SEARCH_CACHE);
      return body;
    }
    if (state.tab === "maps") {
      const answer = await searchMaps(state.filters, state.page);
      return Response.json(
        { tab: "maps", scope: "played", ...answer },
        { headers: { "Cache-Control": SEARCH_CACHE } },
      );
    }
    const answer = await searchPools(state.filters, state.page);
    if ("error" in answer) return noStore(jsonError(400, answer.error));
    return Response.json(
      { tab: "pools", ...answer },
      { headers: { "Cache-Control": SEARCH_CACHE } },
    );
  } catch (error) {
    console.error("search: query failed", error);
    return noStore(jsonError(503, "Search isn't available right now. Try again in a minute."));
  }
}
