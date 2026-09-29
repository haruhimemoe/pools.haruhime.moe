/**
 * @file src/app/page.tsx
 * @desc Home page (building first; past pool counts, Recently built and Recently added): ISR,
 *       hourly (an import shows within the hour, or at once with Refresh public pages on /admin;
 *       admin saves and changes to who can see a built pool revalidate it). Reads no cookies. A
 *       database error fails the render, so ISR keeps serving the last good page. Title
 *       "osu! tournament mappool builder · pools.haruhime.moe", canonical "/", and the JSON-LD
 *       graph: Organization (haruhime.moe), WebSite with its SearchAction, WebApplication and the
 *       FAQ the page shows.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

import { homeMetadata, ld } from "@haruhimemoe/next-kit/seo";
import { JsonLd } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { HomeScreen } from "@/components/home/HomeScreen";
import { HOME_FAQ } from "@/constants/home";
import { APP_FEATURES, SEARCH_URL_TEMPLATE, SEO_SITE } from "@/constants/seo";
import { listPublicBuiltPools } from "@/services/built-listings";
import { listRecentPools, loadHomeCounts } from "@/services/pools";

/** ISR: rebuilt at most once an hour, and on an admin's Refresh public pages. */
export const revalidate = 3600;

/** Public built pools the home page lists. */
const RECENTLY_BUILT = 8;

/** The home page's keyword title, description, canonical "/" and link preview. */
export const metadata: Metadata = homeMetadata(SEO_SITE);

// The JSON-LD: who runs it, the site and its search, the app, and the FAQ.
const HOME_LD = ld.graph(
  ld.organization(SEO_SITE.organization),
  ld.webSite(SEO_SITE, { searchUrlTemplate: SEARCH_URL_TEMPLATE }),
  ld.webApplication(SEO_SITE, { category: "UtilitiesApplication", features: APP_FEATURES }),
  ld.faq(HOME_FAQ),
);

/**
 * @function HomePage
 * @returns {Promise<JSX.Element>} the home page: building first, then past pools and the counts
 */
export default async function HomePage() {
  const [counts, recent, built] = await Promise.all([
    loadHomeCounts(),
    listRecentPools(),
    listPublicBuiltPools(RECENTLY_BUILT),
  ]);
  return (
    <>
      <JsonLd data={HOME_LD} />
      <HomeScreen counts={counts} recent={recent} built={built} />
    </>
  );
}
