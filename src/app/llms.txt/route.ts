/**
 * @file src/app/llms.txt/route.ts
 * @desc GET /llms.txt: a map of the site for AI assistants (llmstxt.org), with every current
 *       past pool, every public built pool and the most used maps. ISR, daily (Refresh public pages on /admin rebuilds it at once);
 *       a database error fails the render, so ISR keeps serving the last good one.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { listPublicBuiltPools } from "@/services/built-listings";
import { listListedMaps } from "@/services/maps";
import { listCurrentPools } from "@/services/pools";
import { buildLlmsTxt, LLMS_MAP_LIMIT, llmsSections } from "@/utils/llms-txt";

/** Rebuilt once a day, and on an admin's Refresh public pages. */
export const revalidate = 86400;

/**
 * @function GET
 * @returns {Promise<Response>} the site's llms.txt as plain text
 */
export async function GET() {
  const [pools, built, maps] = await Promise.all([
    listCurrentPools(),
    listPublicBuiltPools(),
    listListedMaps(LLMS_MAP_LIMIT),
  ]);
  return new Response(buildLlmsTxt(llmsSections({ pools, built, maps })), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
