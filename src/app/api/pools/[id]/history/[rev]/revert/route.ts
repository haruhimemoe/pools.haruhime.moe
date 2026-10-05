/**
 * @file src/app/api/pools/[id]/history/[rev]/revert/route.ts
 * @desc POST: the owner or an editor restores a built pool to an earlier revision. Signed in,
 *       from this site, no body, within the per-user write limit. 200 with the pool at its next
 *       version; 404 for an unknown pool or revision; 400 when today's content rules refuse the
 *       old content; 409 on a lost race. An unlisted or public pool's pack syncs after the
 *       answer. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { schedulePackSync } from "@/lib/pack-sync-after";
import { guardWrite, limitUser, poolResponse, refusalResponse } from "@/lib/pool-routes";
import { revertBuiltPool } from "@/services/built-pool-revert";

type Context = { params: Promise<{ id: string; rev: string }> };

/**
 * @function POST
 * @param request {Request} the incoming request
 * @param context {Context} the route's params (the pool id and the revision to restore)
 * @returns {Promise<Response>} the pool at its next version, or a refusal
 */
export async function POST(request: Request, { params }: Context) {
  const { id, rev } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const limited = await limitUser(RATE_LIMITS.poolOps, caller.value);
  if (limited) return limited;
  const answer = await revertBuiltPool(id, caller.value, rev);
  if (!answer.ok) return refusalResponse(answer);
  schedulePackSync(id);
  return poolResponse({ pool: answer.value });
}
