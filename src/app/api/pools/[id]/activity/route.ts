/**
 * @file src/app/api/pools/[id]/activity/route.ts
 * @desc GET: a built pool's last 20 changes (who, when, what), for its owner and editors only
 *       (src/services/built-pool-activity.ts): signed out 401, can't see it 404, sees it but
 *       doesn't edit it 403. Within the per-user poolOps limit. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { jsonError, noStore } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { limitUser, poolResponse, refusalResponse } from "@/lib/pool-routes";
import { listActivityFor } from "@/services/built-pool-activity";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return noStore(jsonError(401, "Sign in first."));
  const answer = await listActivityFor(id, user);
  if (!answer.ok) return refusalResponse(answer);
  const limited = await limitUser(RATE_LIMITS.poolOps, user);
  if (limited) return limited;
  return poolResponse({ activity: answer.value });
}
