/**
 * @file src/app/api/pools/[id]/values/route.ts
 * @desc GET: each slot's values under its mods (its candidates' too) (stars, AR, OD, CS, BPM, length), keyed by map
 *       and combo ("<id>:<combo>"), for the pool's editor as its slots change
 *       (src/services/slot-values.ts: the mod_values cache, else the hinai mirror, else the
 *       math). The owner or an editor only (signed out 401, can't see it 404, sees it but can't
 *       edit 403), within the per-user ops limit. `{ values, complete }`: a mirror failure, or
 *       the 8 s deadline, still answers, complete false. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { jsonError, noStore } from "@haruhimemoe/next-kit/server";
import { bucketsOf } from "@haruhimemoe/pool";
import { RATE_LIMITS } from "@/constants/api";
import { getUserFromHeaders } from "@/lib/auth";
import { limitUser, poolResponse, refusalResponse } from "@/lib/pool-routes";
import { getBuiltMaps } from "@/services/built-pool-maps";
import { loadFor } from "@/services/built-pool-read";
import { builtSlotValues } from "@/services/slot-values";
import { candidateSlots } from "@/utils/candidate-view";

type Context = { params: Promise<{ id: string }> };

/** The mirror gets SLOT_VALUES_DEADLINE_MS (8 s) for all combos, so this answers well inside. */
export const maxDuration = 30;

/**
 * @function GET
 * @param request {Request} the incoming request
 * @param context {Context} the route's params (the pool id)
 * @returns {Promise<Response>} each slot's values under its mods, marked complete or not
 */
export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return noStore(jsonError(401, "Sign in first."));
  const loaded = await loadFor(id, user, (access) => access.canEdit);
  if (!loaded.ok) return refusalResponse(loaded);
  const limited = await limitUser(RATE_LIMITS.poolOps, user);
  if (limited) return limited;
  const { pool } = loaded.value;
  // Candidates are valued under their slot's mods too.
  const slots = [...pool.slots, ...candidateSlots(pool.candidates)];
  const found = await getBuiltMaps(slots.map((slot) => slot.beatmapId));
  const maps = Object.fromEntries(found.map((map) => [map.id, map]));
  const buckets = bucketsOf(pool);
  return poolResponse(await builtSlotValues({ buckets, slots }, maps));
}
