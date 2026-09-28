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
import {
  type AllMapFilters,
  EMPTY_ALL_MAP_FILTERS,
  EMPTY_MAP_FILTERS,
  type MapFilters,
} from "@/utils/search-filters";
import { searchHref } from "@/utils/search-params";

/**
 * @function scopeHref
 * @param scope {MapScope} the scope to switch to
 * @param filters {AllMapFilters | MapFilters} the current maps filters
 * @returns {string} that scope's search, keeping the text, stars, length and BPM
 */
export const scopeHref = (scope: MapScope, filters: AllMapFilters | MapFilters): string => {
  const shared = { q: filters.q, sr: filters.sr, len: filters.len, bpm: filters.bpm };
  return scope === "all"
    ? searchHref({
        tab: "maps",
        scope,
        page: 1,
        filters: { ...EMPTY_ALL_MAP_FILTERS, ...shared },
      })
    : searchHref({ tab: "maps", scope, page: 1, filters: { ...EMPTY_MAP_FILTERS, ...shared } });
};

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
