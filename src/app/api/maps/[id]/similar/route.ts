/**
 * @file src/app/api/maps/[id]/similar/route.ts
 * @desc GET /api/maps/<id>/similar?mods=&sr=&pool=: maps like this one (src/services/similar-maps.ts),
 *       "pattern match" from BoBERT's table or the "difficulty match" fallback, under the lens,
 *       within the star range, compliance applied. Public: it counts against the search's
 *       per-IP limit (60 a minute), and without `pool` it reads no cookies and stays 5 minutes
 *       on the CDN like search (never when a lookup behind it failed). With `pool` it reads the
 *       session to leave that pool's maps out for its owner and editors, and is never cached.
 *       A bad id is 400; a failed mirror call is 503 similar_unavailable, never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { clientIp, jsonError, noStore, rateLimitSubject } from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { SEARCH_CACHE } from "@/constants/search";
import { SIMILAR_FAILED, SIMILAR_UNAVAILABLE_CODE } from "@/constants/similar";
import { getUserFromHeaders } from "@/lib/auth";
import { refuseOverLimit } from "@/lib/rate-limit";
import { findSimilarMaps } from "@/services/similar-maps";
import { parseSimilarId, parseSimilarQuery } from "@/utils/similar-params";

type Context = { params: Promise<{ id: string }> };

/**
 * @function GET
 * @param request {Request} the incoming request
 * @param context {Context} the route's params (the beatmap id)
 * @returns {Promise<Response>} the similar maps, 400 for a bad id, or 503 similar_unavailable
 */
export async function GET(request: Request, { params }: Context) {
  const limited = await refuseOverLimit(
    RATE_LIMITS.search,
    rateLimitSubject(clientIp(request.headers)),
  );
  if (limited) return limited;
  const id = parseSimilarId((await params).id);
  if (id === null) return noStore(jsonError(400, "That isn't a beatmap id."));
  const query = parseSimilarQuery(new URL(request.url).searchParams);
  try {
    const caller = query.pool ? await getUserFromHeaders(request.headers) : null;
    const result = await findSimilarMaps(id, query, caller);
    if (!result.ok) return noStore(jsonError(503, SIMILAR_FAILED, SIMILAR_UNAVAILABLE_CODE));
    const body = Response.json(result.answer);
    if (!result.cacheable) return noStore(body);
    body.headers.set("Cache-Control", SEARCH_CACHE);
    return body;
  } catch (error) {
    console.error("similar: failed", error);
    return noStore(jsonError(503, SIMILAR_FAILED, SIMILAR_UNAVAILABLE_CODE));
  }
}
