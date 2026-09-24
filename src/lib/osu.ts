/**
 * @file src/lib/osu.ts
 * @desc The one osu! API client for the server, from @haruhimemoe/osu: client credentials from
 *       pools' own osu! app (OSU_CLIENT_ID, OSU_CLIENT_SECRET, the same app admins sign in
 *       with), read on first use; every request sends SERVER_USER_AGENT. Every call goes
 *       through the budget (src/lib/osu-budget.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { createOsuClient, type OsuClient } from "@haruhimemoe/osu";
import { SERVER_USER_AGENT } from "@/constants/site";
import { getServerEnv } from "@/env";

export type { OsuClient } from "@haruhimemoe/osu";
export { OsuApiError } from "@haruhimemoe/osu";

let client: OsuClient | undefined;

/**
 * @function getOsuClient
 * @returns {OsuClient} the process-wide client (its token is cached on it)
 */
export const getOsuClient = (): OsuClient => {
  client ??= createOsuClient({
    userAgent: SERVER_USER_AGENT,
    credentials: () => {
      const env = getServerEnv();
      return { clientId: env.OSU_CLIENT_ID, clientSecret: env.OSU_CLIENT_SECRET };
    },
  });
  return client;
};
