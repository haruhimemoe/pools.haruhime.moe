/**
 * @file src/app/api/pools/route.ts
 * @desc POST: make a pool (src/services/built-pool-create.ts): signed in, from this site, a JSON
 *       body of a name and details or a pool to start from, 10 new pools an hour per user. 201
 *       with its id and the pool, private and empty (or holding the copied maps). Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import {
  guardWrite,
  limitUser,
  poolResponse,
  readPoolBody,
  refusalResponse,
} from "@/lib/pool-routes";
import { createPoolBodySchema } from "@/schemas/built-pool-ops";
import { createBuiltPool } from "@/services/built-pool-create";

/**
 * @function POST
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 201 with the new pool, or a refusal
 */
export async function POST(request: Request) {
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const body = await readPoolBody(request, createPoolBodySchema);
  if (!body.ok) return body.response;
  const limited = await limitUser(RATE_LIMITS.poolCreate, caller.value);
  if (limited) return limited;
  const answer = await createBuiltPool(caller.value, body.value);
  if (!answer.ok) return refusalResponse(answer);
  return poolResponse({ id: answer.value.id, pool: answer.value }, 201);
}
