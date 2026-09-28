/**
 * @file src/components/home/RecentlyBuilt.tsx
 * @desc The home page's "Recently built": public pools built here, newest change first, each
 *       linking its page with its details, map count and who built it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import { Card } from "@haruhimemoe/ui";
import Link from "next/link";
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

export function RecentlyBuilt({ pools }: { pools: readonly ListedBuiltPool[] }) {
  return (
    <Card title="Recently built">
      <ul className="flex flex-col gap-2">
        {pools.map((pool) => (
          <li key={pool.id}>
            <Link href={`/pools/${pool.id}`} className="font-bold text-c1 hover:underline">
              {pool.name}
            </Link>
            <p className="text-c3 text-sm">{lineOf(pool)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
