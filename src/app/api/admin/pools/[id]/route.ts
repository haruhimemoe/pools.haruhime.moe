/**
 * @file src/app/api/admin/pools/[id]/route.ts
 * @desc PATCH, admins only: save a pool's tournament, round, year, notes, hidden and badged, and
 *       update its pack when the pack input changed. Everyone else gets the same 404, so the route
 *       never confirms it exists; then requests from other sites (a sibling *.haruhime.moe host
 *       included) are refused, and the body must be JSON. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { jsonError, noStore, parseJsonBody } from "@haruhimemoe/next-kit/server";
import { refuseCrossSite } from "@/lib/api";
import { getAdminFromHeaders } from "@/lib/auth";
import { poolEditBodySchema } from "@/schemas/admin";
import { savePoolEdit } from "@/services/admin";

type Context = { params: Promise<{ id: string }> };

/** A save can wait on one PUT to packs. */
export const maxDuration = 30;

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!(await getAdminFromHeaders(request.headers))) return jsonError(404, "Not found.");
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const body = await parseJsonBody(request, poolEditBodySchema);
  if (!body.ok) return noStore(body.response);
  const result = await savePoolEdit(id, body.data);
  if (!result) return jsonError(404, "Not found.");
  return noStore(Response.json(result));
}
