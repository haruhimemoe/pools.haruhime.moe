/**
 * @file src/app/page.tsx
 * @desc Home page (building first; past pool counts, Recently built and Recently added): ISR,
 *       hourly (an import shows within the hour, or at once with Refresh public pages on /admin;
 *       admin saves and changes to who can see a built pool revalidate it). Reads no cookies. A
 *       database error fails the render, so ISR keeps serving the last good page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Sep 27, 2026
 */

import { HomeScreen } from "@/components/home/HomeScreen";
import { listPublicBuiltPools } from "@/services/built-listings";
import { listRecentPools, loadHomeCounts } from "@/services/pools";

export const revalidate = 3600;

/** Public built pools the home page lists. */
const RECENTLY_BUILT = 8;

export default async function HomePage() {
  const [counts, recent, built] = await Promise.all([
    loadHomeCounts(),
    listRecentPools(),
    listPublicBuiltPools(RECENTLY_BUILT),
  ]);
  return <HomeScreen counts={counts} recent={recent} built={built} />;
}
