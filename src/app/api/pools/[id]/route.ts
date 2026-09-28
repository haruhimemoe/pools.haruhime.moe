/**
 * @file src/app/api/pools/[id]/route.ts
 * @desc GET: a built pool for anyone allowed to see it (private: owner and editors; hidden:
 *       owner, editors and admins), 404 for everyone else; a pack still waiting to sync syncs
 *       after the answer (the editor asks every 15 s). DELETE: the owner or an admin deletes
 *       it, signed in and from this site, within the per-user write limit; 204, or 200 with
 *       `{ packRemoval: "queued", notice }` when packs couldn't remove its pack yet (the pool is
 *       gone anyway; the removal is retried later). Never cached: the answer depends on who asks.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { PACK_REMOVAL_QUEUED } from "@/constants/built-pools";
import { getUserFromHeaders } from "@/lib/auth";
import { schedulePackSync } from "@/lib/pack-sync-after";
import { guardWrite, limitUser, noContent, poolResponse, refusalResponse } from "@/lib/pool-routes";
import { revalidateBuiltLists } from "@/lib/revalidate";
import { getBuiltPoolFor } from "@/services/built-pool-read";
import { deleteBuiltPool } from "@/services/built-pools";
import { packWaiting } from "@/utils/built-pack";

type Context = { params: Promise<{ id: string }> };

/** A delete may wait on one DELETE to packs; a GET, on a PUT after the answer. */
export const maxDuration = 60;

/**
 * @function GET
 * @param request {Request} the incoming request
 * @param context {Context} the route's params (the pool id)
 * @returns {Promise<Response>} the pool as the caller sees it, or a refusal
 */
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const answer = await getBuiltPoolFor(id, await getUserFromHeaders(request.headers));
  if (!answer.ok) return refusalResponse(answer);
  // The editor asks every 15 s: a change that waited out the 30 s window syncs now.
  if (packWaiting(answer.value.pack)) schedulePackSync(id);
  return poolResponse({ pool: answer.value });
}

/**
 * @function DELETE
 * @param request {Request} the incoming request
 * @param context {Context} the route's params (the pool id)
 * @returns {Promise<Response>} 204 once the pool is gone (200 with a notice when its pack removal
 *          was queued), or a refusal
 */
export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const limited = await limitUser(RATE_LIMITS.poolOps, caller.value);
  if (limited) return limited;
  const answer = await deleteBuiltPool(id, caller.value);
  if (!answer.ok) return refusalResponse(answer);
  revalidateBuiltLists();
  if (answer.value.packRemoval === "queued") {
    return poolResponse({ packRemoval: "queued", notice: PACK_REMOVAL_QUEUED });
  }
  return noContent();
}
