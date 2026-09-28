/**
 * @file src/app/api/admin/pack-cleanup/route.ts
 * @desc POST, admins only: try every pack removal waiting in pack_cleanup (50 at most per call,
 *       due or not) and answer what was removed, kept, still failing and left. Same 404 for
 *       everyone else, then the same-origin guard, then a JSON body (an empty object).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { jsonError, noStore, parseJsonBody } from "@haruhimemoe/next-kit/server";
import { refuseCrossSite } from "@/lib/api";
import { getAdminFromHeaders } from "@/lib/auth";
import { packCleanupBodySchema } from "@/schemas/admin";
import { retryQueuedPackRemovals } from "@/services/admin";

/** 50 DELETEs, one at a time. */
export const maxDuration = 60;

/**
 * @function POST
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} what one run over the pack removal queue did
 */
export async function POST(request: Request) {
  if (!(await getAdminFromHeaders(request.headers))) return jsonError(404, "Not found.");
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const body = await parseJsonBody(request, packCleanupBodySchema);
  if (!body.ok) return noStore(body.response);
  return noStore(Response.json(await retryQueuedPackRemovals()));
}
