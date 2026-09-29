/**
 * @file src/app/sitemap.ts
 * @desc sitemap.xml: the static pages (/submit and /data among them) and the legal pages (their
 *       last update), every current pool, every public built pool that isn't hidden (private and
 *       unlisted ones stay out, and their pages are noindex), and every map 2 or more current
 *       pools use (the rest are noindex; hidden and superseded pools, and maps only they have,
 *       are left out). lastmod is only ever a real date: a pool's updatedAt (the importer writes
 *       it only when a pool's content changed, admins when they edit one, the builder on every
 *       change), a legal page's lastUpdated; the rest have none. ISR, daily (Refresh public
 *       pages on /admin rebuilds it at once); a database error fails the render, so ISR keeps
 *       serving the last good sitemap.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { sitemapEntries } from "@haruhimemoe/next-kit/seo";
import type { MetadataRoute } from "next";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";
import { MAP_INDEX_MIN_POOLS, SEO_SITE } from "@/constants/seo";
import { listPublicBuiltPools } from "@/services/built-listings";
import { listListedMaps } from "@/services/maps";
import { listCurrentPools } from "@/services/pools";

/** Rebuilt once a day, and on an admin's Refresh public pages. */
export const revalidate = 86400;

const STATIC_PATHS = ["/", "/search", "/check", "/submit", "/data", "/credits"] as const;

/**
 * @function sitemap
 * @returns {Promise<MetadataRoute.Sitemap>} the static and legal pages, current past pools,
 *          public built pools with maps, and maps used in 2 or more pools
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pools, built, maps] = await Promise.all([
    listCurrentPools(),
    listPublicBuiltPools(),
    listListedMaps(undefined, MAP_INDEX_MIN_POOLS),
  ]);
  return sitemapEntries(SEO_SITE, [
    STATIC_PATHS,
    LEGAL_SLUGS.map((slug) => ({
      path: `/legal/${slug}`,
      lastModified: LEGAL_DOCS[slug].lastUpdated,
    })),
    pools.map((pool) => ({ path: `/pools/${pool._id}`, lastModified: pool.updatedAt })),
    built.map((pool) => ({ path: `/pools/${pool.id}`, lastModified: pool.updatedAt })),
    maps.map((map) => `/maps/${map._id}`),
  ]);
}
