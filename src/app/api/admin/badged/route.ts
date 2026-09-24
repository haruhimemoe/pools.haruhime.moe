/**
 * @file src/app/api/admin/badged/route.ts
 * @desc POST, admins only: set badged for every pool of a tournament key (one year, unknown years,
 *       or all). Same 404 for everyone else, then the same-origin guard, then a JSON body.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { jsonError, noStore, parseJsonBody, refuseCrossSite } from "@/lib/api";
import { getAdminFromHeaders } from "@/lib/auth";
import { badgedBodySchema } from "@/schemas/admin";
import { setBadged } from "@/services/admin";

export async function POST(request: Request) {
  if (!(await getAdminFromHeaders(request.headers))) return jsonError(404, "Not found.");
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const body = await parseJsonBody(request, badgedBodySchema);
  if (!body.ok) return noStore(body.response);
  return noStore(Response.json(await setBadged(body.data)));
}
