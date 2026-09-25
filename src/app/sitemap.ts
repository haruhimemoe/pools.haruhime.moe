/**
 * @file src/app/sitemap.ts
 * @desc sitemap.xml: the static and legal pages, every current pool, and every map a current
 *       pool uses (hidden and superseded pools, and maps only they have, are left out). ISR,
 *       daily (Refresh public pages on /admin rebuilds it at once); a database error fails the
 *       render, so ISR keeps serving the last good sitemap.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { MetadataRoute } from "next";
import { LEGAL_SLUGS } from "@/constants/legal";
import { SITE } from "@/constants/site";
import { listListedMaps } from "@/services/maps";
import { listCurrentPools } from "@/services/pools";

export const revalidate = 86400;

const STATIC_PATHS = ["/", "/search", "/check", "/credits"] as const;

const at = (path: string): string => `${SITE.url}${path}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pools, maps] = await Promise.all([listCurrentPools(), listListedMaps()]);
  return [
    ...STATIC_PATHS.map((path) => ({ url: at(path) })),
    ...LEGAL_SLUGS.map((slug) => ({ url: at(`/legal/${slug}`) })),
    ...pools.map((pool) => ({ url: at(`/pools/${pool._id}`), lastModified: pool.updatedAt })),
    ...maps.map((map) => ({ url: at(`/maps/${map._id}`) })),
  ];
}
