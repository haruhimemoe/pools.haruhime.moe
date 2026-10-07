/**
 * @file src/constants/content.ts
 * @desc The content registry: every docs and legal page (content/<section>/<slug>.mdx), its
 *       title, description and last update. Pages, .md mirrors, nav, sitemap and both llms
 *       files read it. pools has no guides. The legal section's five entries come from
 *       next-kit's legalEntries, with pools' own titles, descriptions and dates kept as
 *       overrides. Bump an entry's lastUpdated in the same commit as its text.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Tue Oct 6, 2026
 */

import { defineContent } from "@haruhimemoe/next-kit/docs";
import { legalEntries } from "@haruhimemoe/next-kit/legal";
import { LEGAL_SITE } from "@/constants/legal-site";

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
  legal: legalEntries(LEGAL_SITE, {
    disclaimers: {
      title: "Disclaimers",
      description:
        "Who pools isn't affiliated with, where its pool data and star ratings come from, what the content rules check means, and how its requests identify themselves.",
      lastUpdated: "2026-10-06",
    },
    privacy: {
      title: "Privacy",
      description:
        "What pools.haruhime.moe stores when you visit, sign in with osu! and make pools, why, and for how long. No analytics, and no cookies unless you sign in.",
      lastUpdated: "2026-10-06",
    },
    terms: {
      title: "Terms",
      description:
        "The rules for signing in with osu! and making pools on pools.haruhime.moe: what you're responsible for, what gets moderated, and deleting your pools.",
      lastUpdated: "2026-10-06",
    },
    "your-privacy-rights": {
      title: "GDPR & CCPA",
      description:
        "Your rights over your data under the GDPR and the CCPA, what pools stores and why, and how to use these rights.",
      lastUpdated: "2026-10-06",
    },
    copyright: {
      title: "Copyright & Takedown",
      description:
        "pools never hosts beatmap files. How to report a copyright concern about a saved pool, and where to send a DMCA notice.",
      lastUpdated: "2026-10-05",
    },
  }),
});
