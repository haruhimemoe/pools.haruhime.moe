/**
 * @file src/app/api/search/route.ts
 * @desc GET /api/search?tab=pools|maps&...: one page of pool or map results (the query string
 *       src/utils/search-params.ts reads and writes). Counts 60 requests a minute per IP; the CDN
 *       keeps successful answers 5 minutes and never serves them stale, so repeats never reach
 *       the database or the counter and a pool an admin hides is gone within 5 minutes.
 *       Never reads a cookie. A bad "contains map" is 400; a database failure is 503; neither is
 *       cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { SEARCH_CACHE } from "@/constants/search";
import { jsonError, noStore } from "@/lib/api";
import { refuseOverLimit } from "@/lib/rate-limit";
import { searchMaps, searchPools } from "@/services/search";
import { clientIp, rateLimitSubject } from "@/utils/client-ip";
import { parseSearchState } from "@/utils/search-params";

export async function GET(request: Request) {
  const limited = await refuseOverLimit(
    RATE_LIMITS.search,
    rateLimitSubject(clientIp(request.headers)),
  );
  if (limited) return limited;
  const state = parseSearchState(new URL(request.url).searchParams);
  try {
    if (state.tab === "maps") {
      const answer = await searchMaps(state.filters, state.page);
      return Response.json(
        { tab: "maps", ...answer },
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
