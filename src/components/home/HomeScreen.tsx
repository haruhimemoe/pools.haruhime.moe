/**
 * @file src/components/home/HomeScreen.tsx
 * @desc The home page leads with building: "Build an osu! tournament mappool", Make a pool (to
 *       /new, which asks a visitor to sign in) and what the builder does. Then the maps search
 *       (all osu! maps) and past pools as reference: their counts with a link to where they come
 *       from (/data, rather than naming one source), a pools search (a plain GET form), links to
 *       the full search, the check and Submit a pool, then the public pools built here lately
 *       (Recently built) and the past pools added last (Recently added), each left out when
 *       there are none, and last What pools is and the questions (HomeAbout).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 4, 2026
 */

import { Button, ButtonLink, Card, PageHeader, Text, TextInput, TextLink } from "@haruhimemoe/ui";
import type { ReactNode } from "react";
import { HomeAbout } from "@/components/home/HomeAbout";
import { MapSearchForm } from "@/components/home/MapSearchForm";
import { RecentlyBuilt } from "@/components/home/RecentlyBuilt";
import { HOME_FAQ, HOME_INTRO } from "@/constants/home";
import { BUILDER_LINE } from "@/constants/site";
import type { ListedBuiltPool } from "@/services/built-listings";
import type { HomeCounts, RecentPool } from "@/services/pools";
import { poolHeadline } from "@/utils/pool-text";

const countsLine = ({ pools, maps }: HomeCounts): ReactNode =>
  pools === 0 ? (
    "No pools yet."
  ) : (
    <>
      {`${pools} pools · ${maps} maps · `}
      <TextLink href="/data#pools">where they come from</TextLink>
    </>
  );

type HomeScreenProps = {
  counts: HomeCounts;
  recent?: readonly RecentPool[];
  built?: readonly ListedBuiltPool[];
};

/**
 * @function HomeScreen
 * @param props {HomeScreenProps} the counts, the pools added last and the pools built last
 * @returns {JSX.Element} the home page: Make a pool, Recently built, the map search, past pools,
 *          then What pools is and the questions
 */
export function HomeScreen({ counts, recent = [], built = [] }: HomeScreenProps) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Build an osu! tournament mappool"
        lead={BUILDER_LINE}
        actions={
          <ButtonLink href="/new" size="lg">
            Make a pool
          </ButtonLink>
        }
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Search maps">
          <MapSearchForm />
        </Card>
        <Card title="Search past pools">
          <Text tone="muted" className="mb-3">
            {countsLine(counts)}
          </Text>
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
            <Button type="submit" variant="secondary">
              Search pools
            </Button>
          </form>
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
      {built.length > 0 || recent.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {built.length > 0 ? <RecentlyBuilt pools={built} /> : null}
          {recent.length > 0 ? (
            <Card title="Recently added">
              <ul className="flex flex-col gap-2">
                {recent.map((pool) => (
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
      ) : null}
      <HomeAbout intro={HOME_INTRO} faq={HOME_FAQ} />
    </div>
  );
}
