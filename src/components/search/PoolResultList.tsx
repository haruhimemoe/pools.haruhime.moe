/**
 * @file src/components/search/PoolResultList.tsx
 * @desc Pool results: each pool's name (its page), tournament · round · year, map count, no-mod
 *       star range (or "stars pending"), and badged when known.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import Link from "next/link";
import { formatRange, formatStars } from "@/utils/format";
import { badgedText, poolHeadline } from "@/utils/pool-text";
import type { PoolResult } from "@/utils/search-params";

const starsOf = ({ srMin, srMax, complete }: PoolResult["stats"]): string =>
  complete && srMin !== null && srMax !== null
    ? `${formatRange(srMin, srMax, formatStars)}★ (no mod)`
    : "stars pending";

export function PoolResultList({ results }: { results: readonly PoolResult[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {results.map((pool) => {
        const badged = badgedText(pool.badged);
        return (
          <li key={pool.id} className="rounded-lg bg-b4 p-4">
            <Link href={`/pools/${pool.id}`} className="font-bold text-c1 hover:underline">
              {pool.name}
            </Link>
            <p className="text-c3 text-sm">{poolHeadline(pool)}</p>
            <p className="text-c3 text-sm">
              {[
                `${pool.stats.count} ${pool.stats.count === 1 ? "map" : "maps"}`,
                starsOf(pool.stats),
                badged,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
