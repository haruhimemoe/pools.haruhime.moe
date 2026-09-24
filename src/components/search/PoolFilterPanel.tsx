/**
 * @file src/components/search/PoolFilterPanel.tsx
 * @desc The pools filter bar: text, year, badged (only once some pool knows it), star rating
 *       without mods, map count, a contained map (with the route's message when it can't be
 *       read), and the sort.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { FilterPanel, FilterRow, RangeSlider, Select, TextInput } from "@haruhimemoe/ui";
import type { ReactNode } from "react";
import {
  BADGED_FILTERS,
  BADGED_LABELS,
  type BadgedFilter,
  MAP_COUNT_RANGE,
  MAX_MAP_REF_LENGTH,
  MAX_QUERY_LENGTH,
  POOL_SORT_LABELS,
  POOL_SORTS,
  type PoolSort,
  STAR_RANGE,
  YEAR_RANGE,
} from "@/constants/search";
import { formatStars } from "@/utils/format";
import {
  EMPTY_POOL_FILTERS,
  hasPoolFilters,
  normalizeRange,
  type PoolFilters,
} from "@/utils/search-params";

type Props = {
  filters: PoolFilters;
  onChange: (next: PoolFilters) => void;
  badgedKnown: boolean;
  resultCount: ReactNode;
  mapError: string | null;
};

export function PoolFilterPanel({ filters, onChange, badgedKnown, resultCount, mapError }: Props) {
  const set = <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) =>
    onChange({ ...filters, [key]: value });
  return (
    <FilterPanel
      title="Filter pools"
      resultCount={resultCount}
      active={hasPoolFilters(filters)}
      onClear={() => onChange({ ...EMPTY_POOL_FILTERS, q: filters.q, sort: filters.sort })}
    >
      <FilterRow label="Search">
        <TextInput
          id="pools-q"
          label="Tournament, round or pool name"
          value={filters.q}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(event) => set("q", event.target.value)}
        />
      </FilterRow>
      <FilterRow label="Year">
        <RangeSlider
          label="Year"
          hideLabel
          min={YEAR_RANGE.min}
          max={YEAR_RANGE.max}
          step={YEAR_RANGE.step}
          openEnded
          value={filters.year ?? [YEAR_RANGE.min, null]}
          onChange={(value) => set("year", normalizeRange(value, YEAR_RANGE))}
        />
      </FilterRow>
      {badgedKnown ? (
        <FilterRow label="Badged">
          <Select
            id="pools-badged"
            label="Badged"
            value={filters.badged}
            onChange={(event) => set("badged", event.target.value as BadgedFilter)}
          >
            {BADGED_FILTERS.map((value) => (
              <option key={value} value={value}>
                {BADGED_LABELS[value]}
              </option>
            ))}
          </Select>
        </FilterRow>
      ) : null}
      <FilterRow label="Stars (no mod)">
        <RangeSlider
          label="Star rating without mods"
          hideLabel
          min={STAR_RANGE.min}
          max={STAR_RANGE.max}
          step={STAR_RANGE.step}
          openEnded
          format={formatStars}
          value={filters.sr ?? [STAR_RANGE.min, null]}
          onChange={(value) => set("sr", normalizeRange(value, STAR_RANGE))}
        />
      </FilterRow>
      <FilterRow label="Maps">
        <RangeSlider
          label="Number of maps"
          hideLabel
          min={MAP_COUNT_RANGE.min}
          max={MAP_COUNT_RANGE.max}
          step={MAP_COUNT_RANGE.step}
          openEnded
          value={filters.maps ?? [MAP_COUNT_RANGE.min, null]}
          onChange={(value) => set("maps", normalizeRange(value, MAP_COUNT_RANGE))}
        />
      </FilterRow>
      <FilterRow label="Has map">
        <TextInput
          id="pools-map"
          label="Beatmap ID or link"
          value={filters.map}
          maxLength={MAX_MAP_REF_LENGTH}
          error={mapError ?? undefined}
          onChange={(event) => set("map", event.target.value)}
        />
      </FilterRow>
      <FilterRow label="Sort">
        <Select
          id="pools-sort"
          label="Sort pools"
          value={filters.sort}
          onChange={(event) => set("sort", event.target.value as PoolSort)}
        >
          {POOL_SORTS.map((value) => (
            <option key={value} value={value}>
              {POOL_SORT_LABELS[value]}
            </option>
          ))}
        </Select>
      </FilterRow>
    </FilterPanel>
  );
}
