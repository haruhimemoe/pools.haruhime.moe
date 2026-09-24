/**
 * @file src/lib/hinai.ts
 * @desc The one mirror client for server code (the importer's map fill), from
 *       @haruhimemoe/hinai, sending SERVER_USER_AGENT.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import "server-only";
import { createHinaiClient, type HinaiClient } from "@haruhimemoe/hinai";
import { SERVER_USER_AGENT } from "@/constants/site";

let client: HinaiClient | undefined;

/**
 * @function getHinaiClient
 * @returns {HinaiClient} the process-wide mirror client
 */
export const getHinaiClient = (): HinaiClient => {
  client ??= createHinaiClient({ userAgent: SERVER_USER_AGENT });
  return client;
};
