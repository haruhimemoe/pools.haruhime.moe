/**
 * @file src/app/search/page.tsx
 * @desc /search: the search page. ISR, hourly: the server renders a default state (SearchDefault:
 *       the heading, what can be searched, common starts and the latest past pools) as the
 *       Suspense fallback, and the client screen replaces it, reads the URL and fetches
 *       /api/search. Every query string shares the one canonical, /search. A database error
 *       fails the render, so ISR keeps the last good page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchDefault } from "@/components/search/SearchDefault";
import { SearchScreen } from "@/components/search/SearchScreen";
import { PAGE_SEO, SEARCH_LATEST_POOLS, SEO_SITE } from "@/constants/seo";
import { listRecentPools } from "@/services/pools";

/** ISR: the default state's latest pools, rebuilt at most once an hour. */
export const revalidate = 3600;

/** /search's title, description, canonical URL and link preview. */
export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/search",
  ...PAGE_SEO["/search"],
});

/**
 * @function SearchPage
 * @returns {Promise<JSX.Element>} the search page: the default state from the server, then the
 *          client screen, whose results load in the browser
 */
export default async function SearchPage() {
  const latest = await listRecentPools(SEARCH_LATEST_POOLS);
  return (
    <Suspense fallback={<SearchDefault latest={latest} />}>
      <SearchScreen />
    </Suspense>
  );
}
