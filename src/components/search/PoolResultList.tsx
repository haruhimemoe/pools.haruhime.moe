/**
 * @file src/components/search/PoolResultList.tsx
 * @desc Pool results: each pool's name (its page), tournament · round · year, map count, then
 *       for a past pool its no-mod star range (or "stars pending") and badged when known, and
 *       for a pool built here "Built by <owner>".
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { formatRange, formatStars } from "@haruhimemoe/osu/format";
import { Text, TextLink } from "@haruhimemoe/ui";
import type { PoolResult } from "@/schemas/search-response";
import { badgedText, builtHeadline, poolHeadline } from "@/utils/pool-text";

const starsOf = ({ srMin, srMax, complete }: PoolResult["stats"]): string =>
  complete && srMin !== null && srMax !== null
    ? `${formatRange(srMin, srMax, formatStars)}★ (no mod)`
    : "stars pending";

/** A built pool says nothing about details it doesn't have ("year unknown" is past pools'). */
const headlineOf = (pool: PoolResult): string =>
  pool.kind === "built" ? builtHeadline({ ...pool, round: pool.round ?? "" }) : poolHeadline(pool);

const builtByText = (owner: string | null): string =>
  owner ? `Built by ${owner}` : "Built on pools";

/**
 * @function PoolResultList
 * @param props {{ results: readonly PoolResult[] }} one page of pools
 * @returns {JSX.Element} each pool with its round, year, maps and star range
 */
export function PoolResultList({ results }: { results: readonly PoolResult[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {results.map((pool) => {
        const badged = badgedText(pool.badged);
        return (
          <li key={pool.id} className="rounded-lg bg-b4 p-4">
            <TextLink href={`/pools/${pool.id}`} variant="plain">
              {pool.name}
            </TextLink>
            {headlineOf(pool) ? <Text tone="muted">{headlineOf(pool)}</Text> : null}
            <Text tone="muted">
              {[
                `${pool.stats.count} ${pool.stats.count === 1 ? "map" : "maps"}`,
                pool.kind === "built" ? builtByText(pool.builtBy) : starsOf(pool.stats),
                badged,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </li>
        );
      })}
    </ul>
  );
}
