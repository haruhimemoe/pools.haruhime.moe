/**
 * @file src/app/api/internal/similar/[id]/route.ts
 * @desc GET /api/internal/similar/<id>?mods=&sr=&status=: harumin's /practice asking for maps
 *       like a player's top play. Bearer HARUMIN_SERVICE_SECRET; 503 while it's unset, 401
 *       without it. The same body as the public /api/maps/<id>/similar, read with no session,
 *       outside the per-IP limit (every harumin user shares the bot's one IP), never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Oct 8, 2026
 * @modified Thu Oct 8, 2026
 */

import { jsonError, noStore, refuseWithoutBearer } from "@haruhimemoe/next-kit/server";
import { SIMILAR_FAILED, SIMILAR_UNAVAILABLE_CODE } from "@/constants/similar";
import { getHaruminServiceSecret } from "@/env";
import { findSimilarMaps } from "@/services/similar-maps";
import { parseSimilarId, parseSimilarQuery } from "@/utils/similar-params";

type Context = { params: Promise<{ id: string }> };

/**
 * @function GET
 * @param request {Request} harumin's call
 * @param context {Context} the route's params (the beatmap id)
 * @returns {Promise<Response>} the similar maps, 400, 401, or 503
 */
export async function GET(request: Request, { params }: Context) {
  const refused = await refuseWithoutBearer(request, {
    secret: getHaruminServiceSecret,
    label: "harumin",
    notConfigured: "Similar maps for harumin aren't set up.",
    noStore: true,
  });
  if (refused) return refused;
  const id = parseSimilarId((await params).id);
  if (id === null) return noStore(jsonError(400, "That isn't a beatmap id."));
  const query = parseSimilarQuery(new URL(request.url).searchParams);
  try {
    const result = await findSimilarMaps(id, { ...query, pool: null }, null);
    if (!result.ok) return noStore(jsonError(503, SIMILAR_FAILED, SIMILAR_UNAVAILABLE_CODE));
    return noStore(Response.json(result.answer));
  } catch (error) {
    console.error("internal similar: failed", error);
    return noStore(jsonError(503, SIMILAR_FAILED, SIMILAR_UNAVAILABLE_CODE));
  }
}
