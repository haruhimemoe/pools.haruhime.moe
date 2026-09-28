/**
 * @file src/app/api/pools/[id]/route.ts
 * @desc GET: a built pool for anyone allowed to see it (private: owner and editors; hidden:
 *       owner, editors and admins), 404 for everyone else. DELETE: the owner or an admin deletes
 *       it (its pack on packs first), signed in and from this site, within the per-user write
 *       limit; 204. Never cached: the answer depends on who asks.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { getUserFromHeaders } from "@/lib/auth";
import { guardWrite, limitUser, noContent, poolResponse, refusalResponse } from "@/lib/pool-routes";
import { deleteBuiltPool, getBuiltPoolFor } from "@/services/built-pools";

type Context = { params: Promise<{ id: string }> };

/** A delete may wait on one DELETE to packs. */
export const maxDuration = 30;

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const answer = await getBuiltPoolFor(id, await getUserFromHeaders(request.headers));
  if (!answer.ok) return refusalResponse(answer);
  return poolResponse({ pool: answer.value });
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const limited = await limitUser(RATE_LIMITS.poolOps, caller.value);
  if (limited) return limited;
  const answer = await deleteBuiltPool(id, caller.value);
  if (!answer.ok) return refusalResponse(answer);
  return noContent();
}
