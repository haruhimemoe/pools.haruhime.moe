/**
 * @file src/lib/osu-users.ts
 * @desc Looks an osu! user up by username (GET /api/v2/users/@<name>), to add a pool editor who
 *       may never have signed in. Uses pools' own osu! app with client credentials (scope
 *       public), a token cached for the process and fetched again once after a 401, our
 *       User-Agent, a 10 s timeout, and the caller's budget check before the call (the osu!
 *       budget in src/lib/osu-budget.ts). @haruhimemoe/osu's client has no user lookup, so this
 *       makes its own two requests. Never throws; the secret is never logged.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { OSU_BASE_URL, OSU_OAUTH } from "@haruhimemoe/osu/shapes";
import { z } from "zod";
import { SERVER_USER_AGENT } from "@/constants/site";
import { getServerEnv } from "@/env";

export type OsuUserLookup =
  | { kind: "found"; osuId: number; username: string }
  | { kind: "missing" }
  | { kind: "unavailable" };

type Credentials = { clientId: string; clientSecret: string };

export type LookupOptions = {
  /** Asked before the user request; false means osu! isn't asked (default: always ask). */
  beforeCall?: () => Promise<boolean>;
  /** The osu! app (tests); default OSU_CLIENT_ID and OSU_CLIENT_SECRET. */
  credentials?: () => Credentials;
};

const TIMEOUT_MS = 10_000;
/** Refresh this long before osu! says the token expires. */
const EARLY_MS = 60_000;

const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number() });
const userSchema = z.object({ id: z.number().int().positive(), username: z.string().min(1) });

let cached: { token: string; expiresAt: number } | null = null;

/**
 * @function forgetOsuUserToken
 * @returns {void} drops the cached token (tests)
 */
export const forgetOsuUserToken = (): void => {
  cached = null;
};

const envCredentials = (): Credentials => {
  const env = getServerEnv();
  return { clientId: env.OSU_CLIENT_ID, clientSecret: env.OSU_CLIENT_SECRET };
};

const fetchToken = async (credentials: Credentials): Promise<string> => {
  const response = await fetch(OSU_OAUTH.tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "User-Agent": SERVER_USER_AGENT },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "client_credentials",
      scope: "public",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`osu! token request answered ${response.status}`);
  const { access_token, expires_in } = tokenSchema.parse(await response.json());
  cached = { token: access_token, expiresAt: Date.now() + expires_in * 1000 - EARLY_MS };
  return access_token;
};

const userRequest = (username: string, token: string) =>
  fetch(`${OSU_BASE_URL}/api/v2/users/@${encodeURIComponent(username)}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": SERVER_USER_AGENT,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

/**
 * @function lookupOsuUser
 * @param username {string} an osu! username as typed (osu! matches it without case)
 * @param options {LookupOptions} the budget check and credentials
 * @returns {Promise<OsuUserLookup>} the user's id and current name, missing when osu! has nobody
 *          by that name (404), or unavailable (budget refused, a failure, an unreadable answer)
 */
export const lookupOsuUser = async (
  username: string,
  { beforeCall = async () => true, credentials = envCredentials }: LookupOptions = {},
): Promise<OsuUserLookup> => {
  try {
    if (!(await beforeCall())) return { kind: "unavailable" };
    const fresh = cached && cached.expiresAt > Date.now() ? cached.token : null;
    let response = await userRequest(username, fresh ?? (await fetchToken(credentials())));
    if (response.status === 401) {
      response = await userRequest(username, await fetchToken(credentials()));
    }
    if (response.status === 404) return { kind: "missing" };
    if (!response.ok) return { kind: "unavailable" };
    const user = userSchema.safeParse(await response.json());
    if (!user.success) return { kind: "unavailable" };
    return { kind: "found", osuId: user.data.id, username: user.data.username };
  } catch (error) {
    console.error("[osu] user lookup failed", error instanceof Error ? error.message : error);
    return { kind: "unavailable" };
  }
};
