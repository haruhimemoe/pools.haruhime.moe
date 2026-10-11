/**
 * @file src/app/api/internal/pools/[id]/route.ts
 * @desc GET /api/internal/pools/[id]: tourney.haruhime.moe reading a pool a host linked to a
 *       round. Bearer TOURNEY_SERVICE_SECRET; 503 while it's unset, 401 without it. Any
 *       visibility, since a tourney host may link a private or hidden pool; the body is what a
 *       visitor sees of a public pool (no candidates, no editor fields). No pack sync, never
 *       cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Oct 8, 2026
 * @modified Thu Oct 8, 2026
 */

import { refuseWithoutBearer } from "@haruhimemoe/next-kit/server";
import { getTourneyServiceSecret } from "@/env";
import { poolResponse, refusalResponse } from "@/lib/pool-routes";
import { findBuiltPool, viewOf } from "@/services/built-pool-read";
import { NOT_FOUND, refuse } from "@/utils/built-answer";

type Context = { params: Promise<{ id: string }> };

/**
 * @function GET
 * @param request {Request} tourney's call
 * @param context {Context} the route's params (the pool id)
 * @returns {Promise<Response>} 200 `{ pool }`, 401, 404 or 503
 */
export async function GET(request: Request, { params }: Context) {
  const refused = await refuseWithoutBearer(request, {
    secret: getTourneyServiceSecret,
    label: "tourney",
    notConfigured: "Reading pools for tourney isn't set up.",
    noStore: true,
  });
  if (refused) return refused;
  const { id } = await params;
  const pool = await findBuiltPool(id);
  if (!pool) return refusalResponse(refuse(404, "not_found", NOT_FOUND));
  return poolResponse({ pool: await viewOf(pool, null) });
}
