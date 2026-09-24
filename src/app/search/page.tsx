/**
 * @file src/app/search/page.tsx
 * @desc /search: the search page. Static; the client reads the URL and fetches /api/search.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { PageHeader } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchScreen } from "@/components/search/SearchScreen";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search past osu! tournament pools and their maps by tournament, year, star rating, length, BPM, times used and more.",
};

export default function SearchPage() {
  return (
    <Suspense fallback={<PageHeader title="Search" />}>
      <SearchScreen />
    </Suspense>
  );
}
