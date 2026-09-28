/**
 * @file src/app/sitemap.ts
 * @desc sitemap.xml: the static pages (/submit and /data among them) and the legal pages, every
 *       current pool, every public built pool that isn't hidden (private and unlisted ones stay
 *       out, and their pages are noindex), and every map a current pool uses (hidden and
 *       superseded pools, and maps only they have, are left out). ISR, daily (Refresh public
 *       pages on /admin rebuilds it at once); a database error fails the render, so ISR keeps
 *       serving the last good sitemap.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import type { MetadataRoute } from "next";
import { LEGAL_SLUGS } from "@/constants/legal";
import { SITE } from "@/constants/site";
import { listPublicBuiltPools } from "@/services/built-listings";
import { listListedMaps } from "@/services/maps";
import { listCurrentPools } from "@/services/pools";

/** Rebuilt once a day, and on an admin's Refresh public pages. */
export const revalidate = 86400;

const STATIC_PATHS = ["/", "/search", "/check", "/submit", "/data", "/credits"] as const;

const at = (path: string): string => `${SITE.url}${path}`;

/**
 * @function sitemap
 * @returns {Promise<MetadataRoute.Sitemap>} the static pages, current past pools, public built
 *          pools with maps, and listed maps
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pools, built, maps] = await Promise.all([
    listCurrentPools(),
    listPublicBuiltPools(),
    listListedMaps(),
  ]);
  return [
    ...STATIC_PATHS.map((path) => ({ url: at(path) })),
    ...LEGAL_SLUGS.map((slug) => ({ url: at(`/legal/${slug}`) })),
    ...pools.map((pool) => ({ url: at(`/pools/${pool._id}`), lastModified: pool.updatedAt })),
    ...built.map((pool) => ({ url: at(`/pools/${pool.id}`), lastModified: pool.updatedAt })),
    ...maps.map((map) => ({ url: at(`/maps/${map._id}`) })),
  ];
}
