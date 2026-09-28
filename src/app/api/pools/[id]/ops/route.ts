/**
 * @file src/app/api/pools/[id]/ops/route.ts
 * @desc POST `{ baseVersion, ops }`: the owner or an editor changes a built pool, 1 to 20 ops
 *       applied in order, all or nothing (src/services/built-pool-ops.ts). Signed in, from this
 *       site, a JSON body of at most 32 KB, 120 ops a minute per user (each op counts). 200 with
 *       the pool at its next version; 409 with the current pool when baseVersion is stale; 400
 *       naming the op that couldn't apply (`duplicate` for a map already in the pool). An
 *       unlisted or public pool's pack syncs after the answer. Never cached.
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
import { opsBodySchema } from "@/schemas/built-pool-ops";
import { applyBuiltPoolOps } from "@/services/built-pool-ops";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const body = await readPoolBody(request, opsBodySchema);
  if (!body.ok) return body.response;
  const { baseVersion, ops } = body.value;
  const limited = await limitUser(RATE_LIMITS.poolOps, caller.value, ops.length);
  if (limited) return limited;
  const answer = await applyBuiltPoolOps(id, caller.value, baseVersion, ops);
  if (!answer.ok) return refusalResponse(answer);
  schedulePackSync(id);
  return poolResponse({ pool: answer.value });
}
