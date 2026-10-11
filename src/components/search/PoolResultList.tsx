/**
 * @file src/components/search/PoolResultList.tsx
 * @desc Pool results: each pool's name (its page), tournament · round · year, map count, then
 *       for a past pool its no-mod star range (or "stars pending") and badged when known, and
 *       for a pool built here "Built by <owner>".
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 11, 2026
 */

import { formatRange, formatStars } from "@haruhimemoe/osu/format";
import { Surface, Text, TextLink } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import type { PoolResult } from "@/schemas/search-response";
import { badgedText, builtHeadline, poolHeadline } from "@/utils/pool-text";

/** A translator: next-intl's t for this file's catalog keys. */
type T = (key: string, values?: Record<string, string | number>) => string;

const starsOf = ({ srMin, srMax, complete }: PoolResult["stats"]): string =>
  complete && srMin !== null && srMax !== null
    ? `${formatRange(srMin, srMax, formatStars)}★ (no mod)`
    : "stars pending";

/** A built pool says nothing about details it doesn't have ("year unknown" is past pools'). */
const headlineOf = (pool: PoolResult): string =>
  pool.kind === "built" ? builtHeadline({ ...pool, round: pool.round ?? "" }) : poolHeadline(pool);

const builtByText = (t: T, owner: string | null): string =>
  owner ? t("builtByOwner", { owner }) : t("builtOnPools");

/**
 * @function PoolResultList
 * @param props {{ results: readonly PoolResult[] }} one page of pools
 * @returns {JSX.Element} each pool with its round, year, maps and star range
 */
export function PoolResultList({ results }: { results: readonly PoolResult[] }) {
  const t = useTranslations("pools.poolResultList");
  return (
    <ul className="flex flex-col gap-3">
      {results.map((pool) => {
        const badged = badgedText(pool.badged);
        return (
          <Surface as="li" key={pool.id} padding="md">
            <TextLink href={`/pools/${pool.id}`} variant="plain">
              {pool.name}
            </TextLink>
            {headlineOf(pool) ? <Text tone="muted">{headlineOf(pool)}</Text> : null}
            <Text tone="muted">
              {[
                `${pool.stats.count} ${pool.stats.count === 1 ? "map" : "maps"}`,
                pool.kind === "built" ? builtByText(t, pool.builtBy) : starsOf(pool.stats),
                badged,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </Surface>
        );
      })}
    </ul>
  );
}
