/**
 * @file src/app/api/pools/[id]/ops/route.ts
 * @desc POST `{ baseVersion, base?, ops }`: the owner or an editor changes a built pool, 1 to 20
 *       ops applied in order, all or nothing (src/services/built-pool-ops.ts). Signed in, from
 *       this site, a JSON body of at most 32 KB, 120 ops a minute per user (each op counts). 200
 *       with the pool at its next version (`merged` true when a stale save landed onto a change
 *       since); 409 with the current pool when baseVersion is stale and `base` is missing, unknown
 *       or conflicts; 400 naming the op that couldn't apply (`duplicate` for a map already in the
 *       pool). An unlisted or public pool's pack syncs after the answer. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { schedulePackSync } from "@/lib/pack-sync-after";
import {
  guardWrite,
  limitUser,
  poolResponse,
  readPoolBody,
  refusalResponse,
} from "@/lib/pool-routes";
import { opsBodySchema } from "@/schemas/built-pool-ops";
import { applyBuiltPoolOps } from "@/services/built-pool-ops";

type Context = { params: Promise<{ id: string }> };

/**
 * @function POST
 * @param request {Request} the incoming request
 * @param context {Context} the route's params (the pool id)
 * @returns {Promise<Response>} the pool after the ops, a 409 with the current pool, or the refused
 *          op
 */
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const body = await readPoolBody(request, opsBodySchema);
  if (!body.ok) return body.response;
  const { baseVersion, base, ops } = body.value;
  const limited = await limitUser(RATE_LIMITS.poolOps, caller.value, ops.length);
  if (limited) return limited;
  const answer = await applyBuiltPoolOps(id, caller.value, { baseVersion, base }, ops);
  if (!answer.ok) return refusalResponse(answer);
  schedulePackSync(id);
  return poolResponse({ pool: answer.value.pool, merged: answer.value.merged });
}
