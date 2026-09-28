/**
 * @file src/app/api/admin/sync/route.ts
 * @desc POST, admins only: send packs the pools whose last sync failed ({ includeRejected: true }
 *       adds the ones packs rejected), 50 at most per call, and answer what was sent and what's
 *       left. Same 404 for everyone else, then the same-origin guard, then a JSON body.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { jsonError, noStore, parseJsonBody } from "@haruhimemoe/next-kit/server";
import { refuseCrossSite } from "@/lib/api";
import { getAdminFromHeaders } from "@/lib/auth";
import { syncBodySchema } from "@/schemas/admin";
import { retrySyncs } from "@/services/admin";

/** 50 PUTs, 5 at a time. */
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await getAdminFromHeaders(request.headers))) return jsonError(404, "Not found.");
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const body = await parseJsonBody(request, syncBodySchema);
  if (!body.ok) return noStore(body.response);
  return noStore(Response.json(await retrySyncs(body.data)));
}
