/**
 * @file src/components/home/RecentlyBuilt.tsx
 * @desc The home page's "Recently built": public pools built here, newest change first, each
 *       linking its page with its details, map count and who built it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Oct 11, 2026
 */

import { Card, Text, TextLink } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import type { ListedBuiltPool } from "@/services/built-listings";
import { builtHeadline } from "@/utils/pool-text";

/** A translator: next-intl's t for this file's catalog keys. */
type T = (key: string, values?: Record<string, string | number>) => string;

const lineOf = (t: T, pool: ListedBuiltPool): string =>
  [
    builtHeadline(pool),
    `${pool.maps} ${pool.maps === 1 ? "map" : "maps"}`,
    pool.builtBy ? t("builtByBuiltby", { builtBy: pool.builtBy }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * @function RecentlyBuilt
 * @param props {{ pools: readonly ListedBuiltPool[] }} public built pools with maps, newest first
 * @returns {JSX.Element} Recently built, or nothing when there are none
 */
export function RecentlyBuilt({ pools }: { pools: readonly ListedBuiltPool[] }) {
  const t = useTranslations("pools.recentlyBuilt");
  return (
    <Card title={t("recentlyBuilt")}>
      <ul className="flex flex-col gap-2">
        {pools.map((pool) => (
          <li key={pool.id}>
            <TextLink href={`/pools/${pool.id}`} variant="plain">
              {pool.name}
            </TextLink>
            <Text tone="muted">{lineOf(t, pool)}</Text>
          </li>
        ))}
      </ul>
    </Card>
  );
}
