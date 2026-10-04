/**
 * @file src/app/robots.ts
 * @desc robots.txt through next-kit's robots: everything is crawlable except the API (its
 *       OpenAPI document aside), admin, sign-in and account pages, for every search engine and every AI crawler (aiBots
 *       "allow", listed by name so the stance is explicit), plus the sitemap and host. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Oct 3, 2026
 */

import { robots as robotsFor } from "@haruhimemoe/next-kit/seo";
import type { MetadataRoute } from "next";
import { OPENAPI_PATH } from "@/constants/api";
import { SEO_SITE } from "@/constants/seo";

// Paths no crawler should fetch.
const DISALLOWED_PATHS: readonly string[] = ["/api/", "/admin", "/signin", "/account"];

/**
 * @function robots
 * @returns {MetadataRoute.Robots} crawl rules (everything but /api, /admin, /signin and /account,
 *          search and AI crawlers alike), the sitemap and the host
 */
export default function robots(): MetadataRoute.Robots {
  return robotsFor(SEO_SITE, {
    allow: ["/", OPENAPI_PATH],
    disallow: DISALLOWED_PATHS,
    aiBots: "allow",
  });
}
