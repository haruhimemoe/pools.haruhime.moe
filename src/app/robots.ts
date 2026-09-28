/**
 * @file src/app/robots.ts
 * @desc robots.txt: everything is crawlable except the API, admin, sign-in and account pages. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import type { MetadataRoute } from "next";
import { SITE } from "@/constants/site";

/**
 * @function robots
 * @returns {MetadataRoute.Robots} crawl rules (everything but /api, /admin, /signin and /account)
 *          and the sitemap
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/signin", "/account"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
