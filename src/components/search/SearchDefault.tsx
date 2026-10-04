/**
 * @file src/components/search/SearchDefault.tsx
 * @desc /search as the server renders it, before the browser reads the URL: the heading, what
 *       can be searched, common starts and the past pools added last. It's the Suspense fallback
 *       SearchScreen replaces once it loads, so crawlers and AI fetchers that run no script
 *       still get a real page. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sun Oct 4, 2026
 */

import { Card, PageHeader, Text, TextLink } from "@haruhimemoe/ui";
import { SEARCH_HEADING, SEARCH_LEAD } from "@/constants/search";
import { SEARCH_INTRO, SEARCH_STARTS } from "@/constants/seo";
import type { RecentPool } from "@/services/pools";
import { poolHeadline } from "@/utils/pool-text";

/**
 * @function SearchDefault
 * @param props {{ latest: readonly RecentPool[] }} the past pools added last, newest first
 * @returns {JSX.Element} the heading, the intro, common starts and the latest pools
 */
export function SearchDefault({ latest }: { latest: readonly RecentPool[] }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={SEARCH_HEADING} lead={SEARCH_LEAD} />
      <p className="max-w-3xl text-c2">{SEARCH_INTRO}</p>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Common searches">
          <ul className="flex flex-col gap-2">
            {SEARCH_STARTS.map(({ label, href }) => (
              <li key={href}>
                <TextLink href={href} variant="plain">
                  {label}
                </TextLink>
              </li>
            ))}
          </ul>
        </Card>
        {latest.length > 0 ? (
          <Card title="Latest past pools">
            <ul className="flex flex-col gap-2">
              {latest.map((pool) => (
                <li key={pool._id}>
                  <TextLink href={`/pools/${pool._id}`} variant="plain">
                    {pool.name}
                  </TextLink>
                  <Text tone="muted">{poolHeadline(pool)}</Text>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
