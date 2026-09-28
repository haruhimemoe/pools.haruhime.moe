/**
 * @file src/app/api/pools/[id]/visibility/route.ts
 * @desc PUT `{ visibility }`: the owner makes a built pool private, unlisted or public. Signed
 *       in, from this site, JSON, within the per-user write limit. Going private removes its
 *       pack on packs; when packs can't be asked the pool goes private anyway and the answer
 *       adds `packRemoval: "queued"` and a notice. Going unlisted or public syncs its pack after
 *       the answer. The home page, sitemap and llms.txt are marked stale. 200 with the pool.
 *       Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { PACK_REMOVAL_QUEUED } from "@/constants/built-pools";
import { schedulePackSync } from "@/lib/pack-sync-after";
import {
  guardWrite,
  limitUser,
  poolResponse,
  readPoolBody,
  refusalResponse,
} from "@/lib/pool-routes";
import { revalidateBuiltLists } from "@/lib/revalidate";
import { visibilityBodySchema } from "@/schemas/built-pool-ops";
import { setBuiltPoolVisibility } from "@/services/built-pools";

type Context = { params: Promise<{ id: string }> };

/** Going private may wait on one DELETE to packs; going shared, on a PUT after the answer. */
export const maxDuration = 60;

/**
 * @function PUT
 * @param request {Request} the incoming request
 * @param context {Context} the route's params (the pool id)
 * @returns {Promise<Response>} the pool with its new visibility and what happened to its pack, or a
 *          refusal
 */
export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const body = await readPoolBody(request, visibilityBodySchema);
  if (!body.ok) return body.response;
  const limited = await limitUser(RATE_LIMITS.poolOps, caller.value);
  if (limited) return limited;
  const answer = await setBuiltPoolVisibility(id, caller.value, body.value.visibility);
  if (!answer.ok) return refusalResponse(answer);
  const { pool, packRemoval } = answer.value;
  revalidateBuiltLists();
  if (pool.visibility !== "private") schedulePackSync(id);
  if (packRemoval === "queued") {
    return poolResponse({ pool, packRemoval, notice: PACK_REMOVAL_QUEUED });
  }
  return poolResponse({ pool });
}
