/**
 * @file src/lib/osu.ts
 * @desc The one osu! API client for the server, from @haruhimemoe/osu: client credentials from
 *       pools' own osu! app (OSU_CLIENT_ID, OSU_CLIENT_SECRET, the same app admins sign in
 *       with), read on first use; every request sends SERVER_USER_AGENT. Every call goes
 *       through osuBudget: next-kit's createBudget, a global fixed window (50 calls a minute
 *       across every instance) and each caller's share (20 a minute), counted in rate_limits;
 *       its gate says no for the rest of a request after its first no, or a counter it can't
 *       write.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { type Budget, createBudget } from "@haruhimemoe/next-kit/server";
import { createOsuClient, type OsuClient } from "@haruhimemoe/osu";
import type { Db } from "mongodb";
import { OSU_API_BUDGET, OSU_API_BUDGET_PER_IP } from "@/constants/compliance";
import { RATE_LIMITS_COLLECTION } from "@/constants/db";
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

/**
 * @function osuBudget
 * @param db {Db} the pools database
 * @returns {Budget} take and gate over the osu! budget's counters: `gate(subject, now?)` is the
 *          beforeCall a request hands the osu! client (subject: an IP subject or userSubject)
 */
export const osuBudget = (db: Db): Budget =>
  createBudget({
    db: async () => db,
    collection: RATE_LIMITS_COLLECTION,
    global: OSU_API_BUDGET,
    globalSubject: OSU_API_BUDGET.subject,
    perSubject: OSU_API_BUDGET_PER_IP,
  });
