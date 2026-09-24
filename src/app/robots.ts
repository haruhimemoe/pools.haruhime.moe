/**
 * @file src/app/robots.ts
 * @desc robots.txt: everything is crawlable except the API, admin and sign-in. Static.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { MetadataRoute } from "next";
import { SITE } from "@/constants/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/signin"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
