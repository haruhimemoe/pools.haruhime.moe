/**
 * @file src/constants/legal.ts
 * @desc Legal document registry: slugs, titles, descriptions, last-updated dates. The MDX bodies
 *       live in content/legal/<slug>.mdx. Bump lastUpdated in the same commit as any wording
 *       change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

/** The legal pages, by slug. */
export const LEGAL_SLUGS = ["disclaimer", "privacy", "terms"] as const;

/** One of LEGAL_SLUGS. */
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** Each legal page's title, MDX file and last update. */
export const LEGAL_DOCS: Record<
  LegalSlug,
  { title: string; description: string; lastUpdated: string }
> = {
  disclaimer: {
    title: "Disclaimer",
    description:
      "Who pools isn't affiliated with, what its data, star ratings and checks mean, and how its requests identify themselves.",
    lastUpdated: "2026-09-27",
  },
  privacy: {
    title: "Privacy",
    description: "What pools.haruhime.moe stores, why, and for how long.",
    lastUpdated: "2026-09-28",
  },
  terms: {
    title: "Terms",
    description: "The rules for signing in and making pools on pools.haruhime.moe.",
    lastUpdated: "2026-09-27",
  },
};

/**
 * @function isLegalSlug
 * @param value {string} untrusted route segment
 * @returns {boolean} true only for an exact registered slug
 */
export const isLegalSlug = (value: string): value is LegalSlug =>
  (LEGAL_SLUGS as readonly string[]).includes(value);
