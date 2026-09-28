/**
 * @file src/components/search/MapScopeSwitch.tsx
 * @desc The maps tab's scope: All osu! maps or Played in pools, as links (so each scope has its
 *       own URL). Switching keeps the text and the filters both scopes share (stars, length,
 *       BPM) and starts at page 1.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Mon Sep 28, 2026
 */

import { LinkTabs } from "@haruhimemoe/ui";
import { MAP_SCOPE_LABELS, MAP_SCOPES, type MapScope } from "@/constants/search";
import type { AllMapFilters, MapFilters } from "@/utils/search-filters";
import { scopeHref } from "@/utils/search-links";

/**
 * @function MapScopeSwitch
 * @param props {{ scope; filters }} the scope on screen and the maps filters
 * @returns {JSX.Element} All maps / Played in pools as ui's LinkTabs, keeping the shared filters
 */
export function MapScopeSwitch({
  scope,
  filters,
}: {
  scope: MapScope;
  filters: AllMapFilters | MapFilters;
}) {
  return (
    <LinkTabs
      label="Which maps"
      items={MAP_SCOPES.map((value) => ({
        href: scopeHref(value, filters),
        label: MAP_SCOPE_LABELS[value],
        current: scope === value,
      }))}
    />
  );
}
