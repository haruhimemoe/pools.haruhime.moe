/**
 * @file src/utils/hub-cookies.ts
 * @desc The haruhime.moe hub's cookies, for signing out from pools: which of the request's
 *       cookies are the session (better-auth.session_token, and its __Secure- form on https), so
 *       only those are forwarded to the hub, and the Set-Cookie lines that clear every session
 *       cookie (token and cached session_data, both forms) and the shared `haruhime-signed-in`
 *       marker. The Domain attribute is the hub's cookie domain only when the request's host
 *       sits under it (production); on localhost the cookies are host-only, so none is set.
 *       Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

/** better-auth's session cookie names, the secure form first. */
export const SESSION_COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
] as const;

/** Every cookie sign-out clears: the session token and better-auth's cached session, both forms. */
const CLEARED_SESSION_COOKIES = [
  ...SESSION_COOKIE_NAMES,
  "__Secure-better-auth.session_data",
  "better-auth.session_data",
] as const;

/**
 * @function sessionCookieHeader
 * @param cookieHeader {string | null} the request's Cookie header
 * @returns {string | null} a Cookie header with only the session cookies in it, or null when
 *          there's none
 */
export const sessionCookieHeader = (cookieHeader: string | null): string | null => {
  const names: readonly string[] = SESSION_COOKIE_NAMES;
  const kept = (cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => names.includes(part.slice(0, part.indexOf("="))));
  return kept.length > 0 ? kept.join("; ") : null;
};

/**
 * @function cookieDomainFor
 * @param hostname {string} the request's host name
 * @param domain {string} the hub's cookie domain, like .haruhime.moe
 * @returns {string | null} the domain when the host is it or under it, else null (host-only)
 */
export const cookieDomainFor = (hostname: string, domain: string): string | null => {
  const bare = domain.replace(/^\./, "").toLowerCase();
  const host = hostname.toLowerCase();
  return host === bare || host.endsWith(`.${bare}`) ? `.${bare}` : null;
};

/**
 * @function clearHubCookies
 * @param markerName {string} the shared signed-in marker's name
 * @param domain {string | null} the Domain attribute, or null for host-only cookies
 * @returns {string[]} one Set-Cookie line per cookie, each expiring now (Max-Age=0); the
 *          __Secure- ones carry Secure, as browsers require
 */
export const clearHubCookies = (markerName: string, domain: string | null): string[] =>
  [...CLEARED_SESSION_COOKIES, markerName].map((name) =>
    [
      `${name}=`,
      "Path=/",
      "Max-Age=0",
      ...(domain ? [`Domain=${domain}`] : []),
      ...(name.startsWith("__Secure-") ? ["Secure"] : []),
      "SameSite=Lax",
    ].join("; "),
  );
