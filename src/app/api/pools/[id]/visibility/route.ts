/**
 * @file src/app/api/pools/[id]/visibility/route.ts
 * @desc PUT `{ visibility }`: the owner makes a built pool private, unlisted or public. Signed
 *       in, from this site, JSON, within the per-user write limit. Going private removes its
 *       pack on packs; when packs can't be asked the pool goes private anyway and the answer
 *       adds `packRemoval: "queued"` and a notice. 200 with the pool. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { PACK_REMOVAL_QUEUED } from "@/constants/built-pools";
import {
  guardWrite,
  limitUser,
  poolResponse,
  readPoolBody,
  refusalResponse,
} from "@/lib/pool-routes";
import { visibilityBodySchema } from "@/schemas/built-pool-ops";
import { setBuiltPoolVisibility } from "@/services/built-pools";

type Context = { params: Promise<{ id: string }> };

/** Going private may wait on one DELETE to packs. */
export const maxDuration = 30;

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
  if (packRemoval === "queued") {
    return poolResponse({ pool, packRemoval, notice: PACK_REMOVAL_QUEUED });
  }
  return poolResponse({ pool });
}
