/**
 * @file src/app/llms-full.txt/route.ts
 * @desc GET /llms-full.txt: one Markdown file for AI assistants, from next-kit's contentLlmsFull:
 *       the llms.txt notes, every docs and legal page from the content registry, then the full
 *       lists /llms.txt links (the pages, every current past pool, every public built pool with
 *       who built it, the most used maps). Private and unlisted built pools are never listed.
 *       ISR, daily (Refresh public pages on /admin rebuilds it at once); a database error fails
 *       the render, so ISR keeps serving the last good one.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

import { contentLlmsFull } from "@haruhimemoe/next-kit/docs";
import { readContentMarkdown } from "@haruhimemoe/next-kit/docs/files";
import { textResponse } from "@haruhimemoe/next-kit/seo";
import { CONTENT } from "@/constants/content";
import { LLMS_NOTES } from "@/constants/llms";
import { SEO_SITE } from "@/constants/seo";
import { SITE } from "@/constants/site";
import { listPublicBuiltPools } from "@/services/built-listings";
import { listListedMaps } from "@/services/maps";
import { listCurrentPools } from "@/services/pools";
import { CONTENT_MARKDOWN } from "@/utils/content-markdown";
import { LLMS_MAP_LIMIT, llmsSections, llmsSectionsMarkdown } from "@/utils/llms-txt";

/** Rebuilt once a day, and on an admin's Refresh public pages. */
export const revalidate = 86400;

/**
 * @function GET
 * @returns {Promise<Response>} 200 text/markdown: the notes, every content page, then every
 *          current past pool, public built pool and the most used maps
 */
export async function GET() {
  const [pools, built, maps] = await Promise.all([
    listCurrentPools(),
    listPublicBuiltPools(),
    listListedMaps(LLMS_MAP_LIMIT),
  ]);
  const body = await contentLlmsFull({
    site: SEO_SITE,
    title: `${SITE.title} docs, legal pages, pools and maps`,
    summary: SITE.description,
    content: CONTENT,
    read: (s, slug) => readContentMarkdown(CONTENT, s, slug, CONTENT_MARKDOWN).then((m) => m ?? ""),
    before: [{ title: "About pools", markdown: LLMS_NOTES.join("\n\n") }],
    after: [
      {
        title: "Pages, pools and maps",
        markdown: llmsSectionsMarkdown(llmsSections({ pools, built, maps })),
      },
    ],
  });
  return textResponse(body, { type: "text/markdown", maxAge: 3600, sMaxAge: 86400 });
}
