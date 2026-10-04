/**
 * @file src/app/llms.txt/route.ts
 * @desc GET /llms.txt: a short map of the site for AI assistants (llmstxt.org): the notes, the
 *       docs, API and legal sections from the content registry, and
 *       the pages, the latest past and public built pools, a link to /llms-full.txt
 *       and the other haruhime.moe tools. Private and unlisted built pools are never listed. ISR,
 *       daily (Refresh public pages on /admin rebuilds it at once); a database error fails the
 *       render, so ISR keeps serving the last good one.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { textResponse } from "@haruhimemoe/next-kit/seo";
import { listPublicBuiltPools } from "@/services/built-listings";
import { listCurrentPools } from "@/services/pools";
import { buildLlmsTxt, shortLlmsSections } from "@/utils/llms-txt";

/** Rebuilt once a day, and on an admin's Refresh public pages. */
export const revalidate = 86400;

/**
 * @function GET
 * @returns {Promise<Response>} the site's short llms.txt as plain text
 */
export async function GET() {
  const [pools, built] = await Promise.all([listCurrentPools(), listPublicBuiltPools()]);
  return textResponse(buildLlmsTxt(shortLlmsSections({ pools, built })), {
    maxAge: 3600,
    sMaxAge: 86400,
  });
}
