/**
 * @file src/app/api/maps/browse/route.ts
 * @desc GET /api/maps/browse?lens=&status=&...: one page of the map browser (the query string
 *       src/utils/browse-params.ts reads and writes; src/services/map-browse.ts answers it).
 *       Public and cookie-free. Counts against the search's per-IP limit (60 a minute). A page
 *       stays 5 minutes on the CDN like search, never served stale; a page whose setFacts read,
 *       mod values or played-in lookup failed isn't cached. A failed mirror search (an error, a
 *       body that isn't the answer, ready false, or a Retry-After the mirror sent still running,
 *       which answers without asking it) is 503 browse_unavailable, never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { BROWSE_FAILED, BROWSE_UNAVAILABLE_CODE } from "@/constants/browse";
import { SEARCH_CACHE } from "@/constants/search";
import { jsonError, noStore } from "@/lib/api";
import { refuseOverLimit } from "@/lib/rate-limit";
import { browseMaps } from "@/services/map-browse";
import { parseBrowseParams } from "@/utils/browse-params";
import { clientIp, rateLimitSubject } from "@/utils/client-ip";

export async function GET(request: Request) {
  const limited = await refuseOverLimit(
    RATE_LIMITS.search,
    rateLimitSubject(clientIp(request.headers)),
  );
  if (limited) return limited;
  const params = parseBrowseParams(new URL(request.url).searchParams);
  try {
    const result = await browseMaps(params);
    if (!result.ok) return noStore(jsonError(503, BROWSE_FAILED, BROWSE_UNAVAILABLE_CODE));
    const body = Response.json(result.answer);
    if (!result.cacheable) return noStore(body);
    body.headers.set("Cache-Control", SEARCH_CACHE);
    return body;
  } catch (error) {
    console.error("browse: failed", error);
    return noStore(jsonError(503, BROWSE_FAILED, BROWSE_UNAVAILABLE_CODE));
  }
}
