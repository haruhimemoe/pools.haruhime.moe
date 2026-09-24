/**
 * @file src/app/page.tsx
 * @desc Home page: ISR, hourly (an import shows within the hour; admin saves revalidate it).
 *       Reads no cookies; the counts never throw.
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
