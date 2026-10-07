/**
 * @file src/app/api/account/route.ts
 * @desc DELETE: the signed-in user deletes their pools data (src/services/account.ts). Their
 *       haruhime account stays: that's deleted on haruhime.moe/account, the only app that can
 *       write it. A visitor
 *       gets 401; then requests from other sites (a sibling *.haruhime.moe host included) are
 *       refused, and the body must be JSON: `{ username }`, the caller's osu! username as they
 *       typed it to confirm (trimmed, exact case), then at most 3 deletions an hour per osu! account.
 *       Their pools go too (src/services/account.ts), whether or not packs answers: 204, or 200
 *       with `{ packRemovalsQueued, notice }` when some of their packs wait to be removed there.
 *       Either way they stay signed in. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Tue Oct 6, 2026
 */

import { jsonError, noStore, parseJsonBody } from "@haruhimemoe/next-kit/server";
import { z } from "zod";
import { RATE_LIMITS } from "@/constants/api";
import { packRemovalsQueuedText } from "@/constants/built-pools";
import { refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { limitUser } from "@/lib/pool-routes";
import { revalidateBuiltLists } from "@/lib/revalidate";
import { deletePoolsData } from "@/services/account";

const bodySchema = z.strictObject({ username: z.string().trim().max(64) });

const CONFIRM_MISMATCH = "Type your osu! username exactly as it's shown to confirm.";

/** Each owned pool with a pack waits on one DELETE to packs (after one fails, none waits). */
export const maxDuration = 60;

/**
 * @function DELETE
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 204 once the pools data is gone, 200 with a notice when pack removals
 *          were queued, or a refusal
 */
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
  // By osu! id: deleting, signing in again and deleting can't go round it.
  const limited = await limitUser(RATE_LIMITS.accountDelete, user);
  if (limited) return limited;
  const { packRemovalsQueued } = await deletePoolsData(user);
  // Their public pools leave the home page, the sitemap and llms.txt.
  revalidateBuiltLists();
  return noStore(
    packRemovalsQueued > 0
      ? Response.json({ packRemovalsQueued, notice: packRemovalsQueuedText(packRemovalsQueued) })
      : new Response(null, { status: 204 }),
  );
}
