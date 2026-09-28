/**
 * @file src/app/api/candidates/route.ts
 * @desc GET: "Your candidates" for the editor's map browser (src/services/your-candidates.ts):
 *       every candidate, and optionally every pick, from the pools the caller owns or edits,
 *       with their pool, slot, note and values under a bucket of the pool being edited
 *       (`?pool=<id>&under=<code>&bucket=&q=&picks=1&page=`). Signed out 401, a pool the caller
 *       can't see 404, one they can't edit 403, a query without a pool id 400. Within the
 *       per-user ops limit. Never cached, never public.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { jsonError, noStore } from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { getUserFromHeaders } from "@/lib/auth";
import { limitUser, poolResponse, refusalResponse } from "@/lib/pool-routes";
import { readYourCandidatesQuery } from "@/schemas/your-candidates";
import { listYourCandidates } from "@/services/your-candidates";

/** Values under the bucket's mods may ask the mirror (8 s deadline). */
export const maxDuration = 30;

/**
 * @function GET
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} a page of the caller's candidates
 */
export async function GET(request: Request) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return noStore(jsonError(401, "Sign in first."));
  const query = readYourCandidatesQuery(new URL(request.url).searchParams);
  if (!query) return noStore(jsonError(400, "Name the pool you're editing."));
  const limited = await limitUser(RATE_LIMITS.poolOps, user);
  if (limited) return limited;
  const answer = await listYourCandidates(user, query);
  return answer.ok ? poolResponse(answer.value) : refusalResponse(answer);
}
