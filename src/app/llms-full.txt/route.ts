/**
 * @file src/app/llms-full.txt/route.ts
 * @desc GET /llms-full.txt: the full lists /llms.txt links: every current past pool, every
 *       public built pool with who built it and the most used maps, after the same notes and
 *       pages. Private and unlisted built pools are never listed. ISR, daily (Refresh public
 *       pages on /admin rebuilds it at once); a database error fails the render, so ISR keeps
 *       serving the last good one.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { textResponse } from "@haruhimemoe/next-kit/seo";
import { listPublicBuiltPools } from "@/services/built-listings";
import { listListedMaps } from "@/services/maps";
import { listCurrentPools } from "@/services/pools";
import { buildLlmsTxt, LLMS_MAP_LIMIT, llmsSections } from "@/utils/llms-txt";

/** Rebuilt once a day, and on an admin's Refresh public pages. */
export const revalidate = 86400;

/**
 * @function GET
 * @returns {Promise<Response>} every current past pool, public built pool and the most used
 *          maps, in llms.txt form, as plain text
 */
export async function GET() {
  const [pools, built, maps] = await Promise.all([
    listCurrentPools(),
    listPublicBuiltPools(),
    listListedMaps(LLMS_MAP_LIMIT),
  ]);
  return textResponse(buildLlmsTxt(llmsSections({ pools, built, maps })), {
    maxAge: 3600,
    sMaxAge: 86400,
  });
}
