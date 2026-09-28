/**
 * @file src/app/api/pools/[id]/maps/route.ts
 * @desc GET: the details of a built pool's maps, for its editor. The owner or an editor only
 *       (signed out 401, can't see it 404, sees it but can't edit 403), within the per-user ops
 *       limit, since maps pools never saw are filled from the mirror first
 *       (src/services/built-pool-maps.ts). `{ maps, error }`: a mirror failure still answers
 *       with what the maps collection has. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { jsonError, noStore } from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { getUserFromHeaders } from "@/lib/auth";
import { limitUser, poolResponse, refusalResponse } from "@/lib/pool-routes";
import { fillBuiltMaps } from "@/services/built-pool-maps";
import { loadFor } from "@/services/built-pools";

type Context = { params: Promise<{ id: string }> };

/** Up to three mirror tries with their waits. */
export const maxDuration = 30;

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return noStore(jsonError(401, "Sign in first."));
  const loaded = await loadFor(id, user, (access) => access.canEdit);
  if (!loaded.ok) return refusalResponse(loaded);
  const limited = await limitUser(RATE_LIMITS.poolOps, user);
  if (limited) return limited;
  const ids = loaded.value.pool.slots.map((slot) => slot.beatmapId);
  return poolResponse(await fillBuiltMaps(ids));
}
