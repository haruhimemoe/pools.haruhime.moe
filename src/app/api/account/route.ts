/**
 * @file src/app/api/account/route.ts
 * @desc DELETE: the signed-in user deletes their own account (src/services/account.ts). A visitor
 *       gets 401; then requests from other sites (a sibling *.haruhime.moe host included) are
 *       refused, and the body must be JSON: `{ username }`, the caller's osu! username as they
 *       typed it to confirm (trimmed, exact case). Their pools go too (src/services/account.ts);
 *       502 when packs couldn't remove a pool's pack, and the account stays. 204 on success,
 *       clearing the signed-in marker. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { z } from "zod";
import { jsonError, noStore, parseJsonBody, refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { refusalResponse } from "@/lib/pool-routes";
import { SIGNED_IN_COOKIE } from "@/lib/signed-in-marker";
import { deleteAccount } from "@/services/account";

const bodySchema = z.strictObject({ username: z.string().trim().max(64) });

const CONFIRM_MISMATCH = "Type your osu! username exactly as it's shown to confirm.";

/** Each owned pool with a pack waits on one DELETE to packs. */
export const maxDuration = 60;

export async function DELETE(request: Request) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return noStore(jsonError(401, "Sign in first."));
  const crossSite = refuseCrossSite(request);
  if (crossSite) return noStore(crossSite);
  const body = await parseJsonBody(request, bodySchema);
  if (!body.ok) return noStore(body.response);
  if (body.data.username !== user.username) {
    return noStore(jsonError(400, CONFIRM_MISMATCH, "confirm_mismatch"));
  }
  const deleted = await deleteAccount(user);
  if (!deleted.ok) return refusalResponse(deleted);
  const response = noStore(new Response(null, { status: 204 }));
  response.headers.append("Set-Cookie", `${SIGNED_IN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
  return response;
}
