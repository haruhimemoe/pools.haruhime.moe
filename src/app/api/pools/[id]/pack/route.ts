/**
 * @file src/app/api/pools/[id]/pack/route.ts
 * @desc POST: "Update pack now". The owner or an editor syncs an unlisted or public pool's pack
 *       on packs at once, without waiting out the 30 s between syncs. Signed in, from this site,
 *       20 an hour per user; no body. 200 with the pool (its pack synced, or failed with the
 *       reason); 400 for a private or empty pool or one whose pack packs removed; 503 when packs
 *       isn't set up here. Due pack removals are retried after the answer. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { scheduleCleanupRetry } from "@/lib/pack-sync-after";
import { guardWrite, limitUser, poolResponse, refusalResponse } from "@/lib/pool-routes";
import { updatePackNow } from "@/services/built-pack-sync";

type Context = { params: Promise<{ id: string }> };

/**
 * A wait for a sync still out (15 s at most), one PUT to packs (15 s at most), then the
 * cleanup after the answer.
 */
export const maxDuration = 60;

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const caller = await guardWrite(request);
  if (!caller.ok) return caller.response;
  const limited = await limitUser(RATE_LIMITS.packUpdate, caller.value);
  if (limited) return limited;
  const answer = await updatePackNow(id, caller.value);
  if (!answer.ok) return refusalResponse(answer);
  scheduleCleanupRetry();
  return poolResponse({ pool: answer.value });
}
