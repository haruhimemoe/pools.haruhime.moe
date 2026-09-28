/**
 * @file src/app/api/pools/[id]/owner/route.ts
 * @desc POST `{ osuId, confirmName }`: the owner hands the pool to one of its editors, typing
 *       the pool's name exactly (src/services/built-pool-owner.ts). The editor must have signed
 *       in and own fewer than 50 pools; the old owner stays on as an editor. Signed in, from
 *       this site, strict JSON, and one of the 30 editor changes an hour per user. 200 with the
 *       pool; 400 for a wrong name, someone who doesn't edit it, an editor who hasn't signed in
 *       or one at the cap; 409 when it changed meanwhile. A shared pool's pack (its credit line
 *       names the owner) syncs after the answer. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
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
import { ownerBodySchema } from "@/schemas/built-pool-ops";
import { transferBuiltPool } from "@/services/built-pool-owner";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const body = await readPoolBody(request, ownerBodySchema);
  if (!body.ok) return body.response;
  const limited = await limitUser(RATE_LIMITS.poolEditors, caller.value);
  if (limited) return limited;
  const { osuId, confirmName } = body.value;
  const answer = await transferBuiltPool(id, caller.value, osuId, confirmName);
  if (!answer.ok) return refusalResponse(answer);
  schedulePackSync(id);
  return poolResponse({ pool: answer.value });
}
