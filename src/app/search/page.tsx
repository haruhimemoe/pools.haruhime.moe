/**
 * @file src/app/search/page.tsx
 * @desc /search: the search page. Static; the client reads the URL and fetches /api/search.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

import { PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchScreen } from "@/components/search/SearchScreen";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search past osu! tournament pools, the maps they played, and every osu! map by status, star rating, length and BPM, with maps officially supported tournaments can't use left out.",
};

export default function SearchPage() {
  return (
    <Suspense fallback={<PageHeader title="Search" />}>
      <SearchScreen />
    </Suspense>
  );
}
