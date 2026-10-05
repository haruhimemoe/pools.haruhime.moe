/**
 * @file src/app/api/pools/[id]/history/route.ts
 * @desc PUT `{ historyPublic }`: the owner makes a built pool's history public or private.
 *       Signed in, from this site, within the per-user write limit. 200 with the pool (a new
 *       version unless nothing changed); 404 or 403 for anyone but the owner. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import {
  guardWrite,
  limitUser,
  poolResponse,
  readPoolBody,
  refusalResponse,
} from "@/lib/pool-routes";
import { historyBodySchema } from "@/schemas/built-history";
import { setHistoryPublic } from "@/services/built-pool-history-read";

type Context = { params: Promise<{ id: string }> };

/**
 * @function PUT
 * @param request {Request} the incoming request
 * @param context {Context} the route's params (the pool id)
 * @returns {Promise<Response>} the pool with its history's new visibility, or a refusal
 */
export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const body = await readPoolBody(request, historyBodySchema);
  if (!body.ok) return body.response;
  const limited = await limitUser(RATE_LIMITS.poolOps, caller.value);
  if (limited) return limited;
  const answer = await setHistoryPublic(id, caller.value, body.value.historyPublic);
  return answer.ok ? poolResponse({ pool: answer.value }) : refusalResponse(answer);
}
