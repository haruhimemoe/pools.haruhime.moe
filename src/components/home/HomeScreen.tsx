/**
 * @file src/components/home/HomeScreen.tsx
 * @desc The home page: what pools is, its counts, a pools search (a plain GET form), the maps
 *       search, and links to the full search and the check.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { Button, ButtonLink, Card, PageHeader, TextInput } from "@haruhimemoe/ui";
import { MapSearchForm } from "@/components/home/MapSearchForm";
import { SOURCE_CREDITS } from "@/constants/pools";
import type { HomeCounts } from "@/services/pools";

const countsLine = ({ pools, maps, sources }: HomeCounts): string =>
  pools === 0
    ? "No pools yet."
    : `${pools} pools · ${maps} maps · from ${sources.map((kind) => SOURCE_CREDITS[kind].label).join(", ")}`;

export function HomeScreen({ counts }: { counts: HomeCounts }) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Past osu! tournament mappools"
        lead="Search pools and maps from past tournaments, see where a map was played before, and check a pool you're building against the content rules for officially supported tournaments."
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
      </div>
    </div>
  );
}
