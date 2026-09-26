/**
 * @file src/components/home/HomeScreen.tsx
 * @desc The home page: what pools is, its counts with a link to where pools come from (/data,
 *       rather than naming one source), a pools search (a plain GET form), the maps search (all
 *       osu! maps), links to the full search, the check and Submit a pool, and the pools added
 *       last (left out when there are none).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sat Sep 26, 2026
 */

import { Button, ButtonLink, Card, PageHeader, TextInput } from "@haruhimemoe/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { MapSearchForm } from "@/components/home/MapSearchForm";
import type { HomeCounts, RecentPool } from "@/services/pools";
import { poolHeadline } from "@/utils/pool-text";

const countsLine = ({ pools, maps }: HomeCounts): ReactNode =>
  pools === 0 ? (
    "No pools yet."
  ) : (
    <>
      {`${pools} pools · ${maps} maps · `}
      <Link href="/data#pools" className="underline transition-colors hover:text-c1">
        where they come from
      </Link>
    </>
  );

export function HomeScreen({
  counts,
  recent = [],
}: {
  counts: HomeCounts;
  recent?: readonly RecentPool[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Past osu! tournament mappools"
        lead="Search pools from past tournaments and every osu! map, see where a map was played before, and check a pool you're building against the content rules for officially supported tournaments."
        meta={countsLine(counts)}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Search pools">
          {/* biome-ignore lint/a11y/useSemanticElements: the form is the landmark (older screen readers don't map <search>) */}
          <form
            action="/search"
            method="get"
            role="search"
            aria-label="Pools"
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="tab" value="pools" />
            <TextInput
              id="home-pools"
              name="q"
              label="Tournament, round or pool name"
              autoComplete="off"
            />
            <Button type="submit" className="self-start">
              Search pools
            </Button>
          </form>
        </Card>
        <Card title="Search maps">
          <MapSearchForm />
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/search" variant="secondary">
          Browse and filter
        </ButtonLink>
        <ButtonLink href="/check" variant="secondary">
          Check a pool
        </ButtonLink>
        <ButtonLink href="/submit" variant="secondary">
          Submit a pool
        </ButtonLink>
      </div>
      {recent.length > 0 ? (
        <Card title="Recently added">
          <ul className="flex flex-col gap-2">
            {recent.map((pool) => (
              <li key={pool._id}>
                <Link href={`/pools/${pool._id}`} className="font-bold text-c1 hover:underline">
                  {pool.name}
                </Link>
                <p className="text-c3 text-sm">{poolHeadline(pool)}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
