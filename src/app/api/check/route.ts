/**
 * @file src/app/api/check/route.ts
 * @desc GET /api/check?ids=1,2,3 (1 to 64 beatmap ids): each map's beatmapset verdict against the
 *       content rules for officially supported tournaments, the ids with none (missing,
 *       unchecked), and what pools knows about each map. 30 checks a minute per IP, and every
 *       osu! call spends the global budget and the IP's share. A complete answer stays a day on
 *       the CDN; a partial one is never cached. Reads no cookies.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { CHECK_CACHE } from "@/constants/compliance";
import { BAD_CHECK_IDS, jsonError, noStore, parseBeatmapIds } from "@/lib/api";
import { refuseOverLimit } from "@/lib/rate-limit";
import type { CheckResponse } from "@/schemas/compliance";
import { checkCompliance, checkMaps } from "@/services/compliance";
import { clientIp, rateLimitSubject } from "@/utils/client-ip";

/** A check with many uncached sets makes a few osu! calls. */
export const maxDuration = 30;

export async function GET(request: Request) {
  const ids = parseBeatmapIds(new URL(request.url).searchParams.get("ids"));
  if (!ids) return noStore(jsonError(400, BAD_CHECK_IDS));
  const subject = rateLimitSubject(clientIp(request.headers));
  const limited = await refuseOverLimit(RATE_LIMITS.check, subject);
  if (limited) return limited;
  const [result, maps] = await Promise.all([checkCompliance(ids, { subject }), checkMaps(ids)]);
  const body: CheckResponse = { ...result, maps };
  return Response.json(body, {
    headers: { "Cache-Control": result.unchecked.length === 0 ? CHECK_CACHE : "no-store" },
  });
}
