/**
 * @file src/app/api/me/api-key/route.ts
 * @desc The signed-in user's API key (session auth, for the account page). GET: prefix and dates.
 *       POST: create or regenerate (the old key stops working at once), 10 an hour; the full
 *       key is in this response only. DELETE: revoke. POST and DELETE read no body, so both
 *       refuse requests from other sites (refuseCrossSite).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Oct 3, 2026
 * @modified Sat Oct 3, 2026
 */

import {
  jsonError,
  rateLimitHeaders,
  tooManyRequests,
  withHeaders,
} from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { refuseCrossSite } from "@/lib/api";
import { apiKeys } from "@/lib/api-keys";
import { getUserFromHeaders } from "@/lib/auth";
import { limiter } from "@/lib/rate-limit";

const SIGN_IN = "Sign in with osu! to manage your API key.";
const NO_KEY = "You don't have an API key.";
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * @function GET
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 200, 401
 */
export async function GET(request: Request) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN);
  return Response.json({ apiKey: await apiKeys.info(user.id) }, { headers: NO_STORE });
}

/**
 * @function POST
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 201, 401, 403, 429
 */
export async function POST(request: Request) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN);
  const limit = await limiter.hit(RATE_LIMITS.keyCreate, user.id);
  if (!limit.allowed) return withHeaders(tooManyRequests(limit), NO_STORE);
  return Response.json(await apiKeys.issue(user.id), {
    status: 201,
    headers: { ...rateLimitHeaders(limit), ...NO_STORE },
  });
}

/**
 * @function DELETE
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 204, 401, 403, 404
 */
export async function DELETE(request: Request) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN);
  if (!(await apiKeys.revoke(user.id))) return jsonError(404, NO_KEY);
  return new Response(null, { status: 204 });
}
