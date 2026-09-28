/**
 * @file src/app/api/admin/revalidate/route.ts
 * @desc POST, admins only: mark every public page stale (the home page, the sitemap, llms.txt and
 *       every pool and map page), so they show an import at once instead of when their hour or
 *       day runs out. The importer runs outside the site and can't do this itself. Same 404 for
 *       everyone else, then the same-origin guard, then a JSON body ({}).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { jsonError, noStore, parseJsonBody } from "@haruhimemoe/next-kit/server";
import { refuseCrossSite } from "@/lib/api";
import { getAdminFromHeaders } from "@/lib/auth";
import { revalidateAllPoolAndMapPages } from "@/lib/revalidate";
import { revalidateBodySchema } from "@/schemas/admin";

export async function POST(request: Request) {
  if (!(await getAdminFromHeaders(request.headers))) return jsonError(404, "Not found.");
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const body = await parseJsonBody(request, revalidateBodySchema);
  if (!body.ok) return noStore(body.response);
  revalidateAllPoolAndMapPages();
  return noStore(Response.json({ ok: true }));
}
