/**
 * @file src/constants/content.ts
 * @desc The content registry: every docs and legal page (content/<section>/<slug>.mdx), its
 *       title, description and last update. Pages, .md mirrors, nav, sitemap and both llms
 *       files read it. pools has no guides. Bump an entry's lastUpdated in the same commit as
 *       its text.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { defineContent } from "@haruhimemoe/next-kit/docs";

/** Every docs and legal page, validated by next-kit's defineContent. */
export const CONTENT = defineContent({
  docs: [
    {
      slug: "api",
      title: "API",
      description:
        "The pools.haruhime.moe API for scripts and bots: hpl_ keys from your account page, the rate limits, GET /api/v1/me with a curl example and the OpenAPI document.",
      lastUpdated: "2026-10-03",
    },
  ],
  legal: [
    {
      slug: "disclaimer",
      title: "Disclaimer",
      description:
        "Who pools isn't affiliated with, where its pool data and star ratings come from, what the content rules check means, and how its requests identify themselves.",
      lastUpdated: "2026-09-28",
    },
    {
      slug: "privacy",
      title: "Privacy",
      description:
        "What pools.haruhime.moe stores when you visit, sign in with osu! and make pools, why, and for how long. No analytics, and no cookies unless you sign in.",
      lastUpdated: "2026-10-05",
    },
    {
      slug: "terms",
      title: "Terms",
      description:
        "The rules for signing in with osu! and making pools on pools.haruhime.moe: what you're responsible for, what gets moderated, and deleting a pool or account.",
      lastUpdated: "2026-09-27",
    },
  ],
});
