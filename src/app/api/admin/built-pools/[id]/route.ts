/**
 * @file src/app/api/admin/built-pools/[id]/route.ts
 * @desc Moderating a built pool, admins only (everyone else gets the same 404, then other sites
 *       are refused). PATCH `{ hidden }`: hide it or show it again; a public pool's pack goes to
 *       packs after the answer, unlisted while hidden, without waiting out the 30 s between
 *       syncs. 200 with the pool's id, hidden and version. DELETE: delete it, its pack removed
 *       on packs as the owner's delete does (204, or 200 with `packRemoval: "queued"` and a
 *       notice when packs didn't answer). Either marks the home page, sitemap and llms.txt stale.
 *       Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { jsonError, noStore, parseJsonBody } from "@haruhimemoe/next-kit/server";
import { PACK_REMOVAL_QUEUED } from "@/constants/built-pools";
import { refuseCrossSite } from "@/lib/api";
import { getAdminFromHeaders } from "@/lib/auth";
import { schedulePackSync } from "@/lib/pack-sync-after";
import { revalidateBuiltLists } from "@/lib/revalidate";
import { builtHiddenBodySchema } from "@/schemas/admin";
import { setBuiltPoolHidden } from "@/services/built-moderation";
import { deleteBuiltPool } from "@/services/built-pools";

type Context = { params: Promise<{ id: string }> };

/** A delete may wait on one DELETE to packs; a hide, on a PUT after the answer. */
export const maxDuration = 60;

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!(await getAdminFromHeaders(request.headers))) return jsonError(404, "Not found.");
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const body = await parseJsonBody(request, builtHiddenBodySchema);
  if (!body.ok) return noStore(body.response);
  const result = await setBuiltPoolHidden(id, body.data.hidden);
  if (!result) return noStore(jsonError(404, "Not found."));
  const { pool, changed } = result;
  if (changed && pool.visibility === "public") {
    schedulePackSync(id, { force: true });
    revalidateBuiltLists();
  }
  return noStore(
    Response.json({ pool: { id: pool._id, hidden: pool.hidden, version: pool.version } }),
  );
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  const admin = await getAdminFromHeaders(request.headers);
  if (!admin) return jsonError(404, "Not found.");
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const answer = await deleteBuiltPool(id, { ...admin, isAdmin: true });
  if (!answer.ok) return noStore(jsonError(404, "Not found."));
  revalidateBuiltLists();
  if (answer.value.packRemoval === "queued") {
    return noStore(Response.json({ packRemoval: "queued", notice: PACK_REMOVAL_QUEUED }));
  }
  return noStore(new Response(null, { status: 204 }));
}
