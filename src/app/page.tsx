/**
 * @file src/app/page.tsx
 * @desc Home page: ISR, hourly (an import shows within the hour, or at once with Refresh public
 *       pages on /admin; admin saves revalidate it). Reads no cookies. A database error fails the
 *       render, so ISR keeps serving the last good page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { HomeScreen } from "@/components/home/HomeScreen";
import { loadHomeCounts } from "@/services/pools";

export const revalidate = 3600;

export default async function HomePage() {
  return <HomeScreen counts={await loadHomeCounts()} />;
}
