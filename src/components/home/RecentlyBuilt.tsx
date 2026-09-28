/**
 * @file src/components/home/RecentlyBuilt.tsx
 * @desc The home page's "Recently built": public pools built here, newest change first, each
 *       linking its page with its details, map count and who built it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import { Card, TextLink } from "@haruhimemoe/ui";
import type { ListedBuiltPool } from "@/services/built-listings";
import { builtHeadline } from "@/utils/pool-text";

const lineOf = (pool: ListedBuiltPool): string =>
  [
    builtHeadline(pool),
    `${pool.maps} ${pool.maps === 1 ? "map" : "maps"}`,
    pool.builtBy ? `Built by ${pool.builtBy}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * @function RecentlyBuilt
 * @param props {{ pools: readonly ListedBuiltPool[] }} public built pools with maps, newest first
 * @returns {JSX.Element} Recently built, or nothing when there are none
 */
export function RecentlyBuilt({ pools }: { pools: readonly ListedBuiltPool[] }) {
  return (
    <Card title="Recently built">
      <ul className="flex flex-col gap-2">
        {pools.map((pool) => (
          <li key={pool.id}>
            <TextLink href={`/pools/${pool.id}`} variant="plain">
              {pool.name}
            </TextLink>
            <p className="text-c3 text-sm">{lineOf(pool)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
