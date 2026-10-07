/**
 * @file src/app/api/signout/route.ts
 * @desc POST /api/signout: signs out of the haruhime.moe hub without leaving pools. Requests from
 *       other sites (a sibling *.haruhime.moe host included) are refused first. Then only the
 *       session cookie is forwarded to the hub's /api/auth/sign-out, from pools' origin (the hub
 *       trusts it), with redirects not followed and a 5-second cap; whatever the hub answers,
 *       pools clears the session cookies (token and cached session, plain and __Secure-) and the
 *       shared `haruhime-signed-in` marker on the hub's cookie domain (host-only on localhost).
 *       204. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { noStore } from "@haruhimemoe/next-kit/server";
import { HUB_COOKIE_DOMAIN, SERVER_USER_AGENT, SIGNED_IN_COOKIE, SITE } from "@/constants/site";
import { getHubUrl } from "@/env";
import { refuseCrossSite } from "@/lib/api";
import { clearHubCookies, cookieDomainFor, sessionCookieHeader } from "@/utils/hub-cookies";

/** How long the hub gets to end the session. */
const HUB_TIMEOUT_MS = 5000;

/**
 * @function endHubSession
 * @param cookie {string} the session cookie, alone
 * @returns {Promise<void>} once the hub answered, or failed to (logged, never thrown: the
 *          cookies are cleared either way)
 */
const endHubSession = async (cookie: string): Promise<void> => {
  try {
    await fetch(new URL("/api/auth/sign-out", getHubUrl()), {
      method: "POST",
      headers: {
        cookie,
        origin: SITE.url,
        "content-type": "application/json",
        "user-agent": SERVER_USER_AGENT,
      },
      body: "{}",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[signout] the hub didn't end the session", error);
  }
};

/**
 * @function POST
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 204 with the hub's cookies cleared, or 403 from another site
 */
export async function POST(request: Request) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return noStore(crossSite);
  const cookie = sessionCookieHeader(request.headers.get("cookie"));
  if (cookie) await endHubSession(cookie);
  const response = noStore(new Response(null, { status: 204 }));
  const domain = cookieDomainFor(new URL(request.url).hostname, HUB_COOKIE_DOMAIN);
  for (const line of clearHubCookies(SIGNED_IN_COOKIE, domain)) {
    response.headers.append("Set-Cookie", line);
  }
  return response;
}
