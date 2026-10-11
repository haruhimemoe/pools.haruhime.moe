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
 * @modified Sun Oct 11, 2026
 */

import { Button, ButtonLink, Card, PageHeader, Text, TextInput, TextLink } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { HomeAbout } from "@/components/home/HomeAbout";
import { MapSearchForm } from "@/components/home/MapSearchForm";
import { RecentlyBuilt } from "@/components/home/RecentlyBuilt";
import { HOME_FAQ, HOME_INTRO } from "@/constants/home";
import { BUILDER_LINE } from "@/constants/site";
import type { ListedBuiltPool } from "@/services/built-listings";
import type { HomeCounts, RecentPool } from "@/services/pools";
import { poolHeadline } from "@/utils/pool-text";

const countsLine = (
  t: ReturnType<typeof useTranslations>,
  { pools, maps }: HomeCounts,
): ReactNode =>
  pools === 0 ? (
    t("noPools")
  ) : (
    <>
      {t("counts", { pools, maps })}
      <TextLink href="/data#pools">{t("whereTheyComeFrom")}</TextLink>
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
  const t = useTranslations("pools.homeScreen");
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("buildAnOsuTournament")}
        lead={BUILDER_LINE}
        actions={
          <ButtonLink href="/new" size="lg">
            {t("makeAPool")}
          </ButtonLink>
        }
      />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title={t("searchMaps")}>
          <MapSearchForm />
        </Card>
        <Card title={t("searchPastPools")}>
          <Text tone="muted" className="mb-3">
            {countsLine(t, counts)}
          </Text>
          {/* biome-ignore lint/a11y/useSemanticElements: the form is the landmark (older screen readers don't map <search>) */}
          <form
            action="/search"
            method="get"
            role="search"
            aria-label={t("pools")}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="tab" value="pools" />
            <TextInput
              id="home-pools"
              name="q"
              label={t("tournamentRoundOrPool")}
              autoComplete="off"
            />
            <Button type="submit" variant="secondary">
              {t("searchPools")}
            </Button>
          </form>
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/search" variant="secondary">
          {t("browseAndFilter")}
        </ButtonLink>
        <ButtonLink href="/check" variant="secondary">
          {t("checkAPool")}
        </ButtonLink>
        <ButtonLink href="/submit" variant="secondary">
          {t("submitAPool")}
        </ButtonLink>
      </div>
      {built.length > 0 || recent.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {built.length > 0 ? <RecentlyBuilt pools={built} /> : null}
          {recent.length > 0 ? (
            <Card title={t("recentlyAdded")}>
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
