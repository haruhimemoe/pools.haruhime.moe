/**
 * @file src/components/search/AllMapFilterPanel.tsx
 * @desc Filters for searching every osu! map: the text, one status at a time as a radio group
 *       (Ranked by default, which includes approved; Loved, Qualified, Pending, Graveyard), star
 *       rating
 *       (no mod), length and BPM ranges, and Show explicit maps (hidden unless ticked).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sat Sep 26, 2026
 */

"use client";

import { Checkbox, FilterPanel, FilterRow, RangeSlider, TextInput } from "@haruhimemoe/ui";
import type { ReactNode } from "react";
import { StatusChips } from "@/components/search/StatusChips";
import {
  BPM_RANGE,
  type FilterBounds,
  LENGTH_RANGE,
  MAX_QUERY_LENGTH,
  STAR_RANGE,
} from "@/constants/search";
import { formatDuration, formatStars } from "@/utils/format";
import {
  type AllMapFilters,
  EMPTY_ALL_MAP_FILTERS,
  hasAllMapFilters,
  normalizeRange,
  parseLengthText,
  type Range,
} from "@/utils/search-params";

type Props = {
  filters: AllMapFilters;
  onChange: (next: AllMapFilters) => void;
  resultCount: ReactNode;
};

type RangeKey = "sr" | "len" | "bpm";

const RANGES: readonly {
  key: RangeKey;
  row: string;
  label: string;
  bounds: FilterBounds;
  format?: (n: number) => string;
  parse?: (text: string) => number | null;
}[] = [
  {
    key: "sr",
    row: "Stars (no mod)",
    label: "Star rating without mods",
    bounds: STAR_RANGE,
    format: formatStars,
  },
  {
    key: "len",
    row: "Length",
    label: "Length",
    bounds: LENGTH_RANGE,
    format: formatDuration,
    parse: parseLengthText,
  },
  { key: "bpm", row: "BPM", label: "BPM", bounds: BPM_RANGE },
];

export function AllMapFilterPanel({ filters, onChange, resultCount }: Props) {
  const setRange = (key: RangeKey, value: Range | null) => onChange({ ...filters, [key]: value });
  return (
    <FilterPanel
      title="Filter maps"
      resultCount={resultCount}
      active={hasAllMapFilters(filters)}
      onClear={() => onChange({ ...EMPTY_ALL_MAP_FILTERS, q: filters.q })}
    >
      <FilterRow label="Search">
        <TextInput
          id="all-maps-q"
          label="Title, artist or mapper"
          value={filters.q}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </FilterRow>
      <FilterRow label="Status">
        <StatusChips
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
        />
      </FilterRow>
      {RANGES.map(({ key, row, label, bounds, format, parse }) => (
        <FilterRow key={key} label={row}>
          <RangeSlider
            label={label}
            hideLabel
            min={bounds.min}
            max={bounds.max}
            step={bounds.step}
            openEnded
            format={format}
            parse={parse}
            value={filters[key] ?? [bounds.min, null]}
            onChange={(value) => setRange(key, normalizeRange(value, bounds))}
          />
        </FilterRow>
      ))}
      <FilterRow label="Explicit">
        <Checkbox
          id="all-maps-explicit"
          label="Show explicit maps"
          checked={filters.explicit}
          onChange={(event) => onChange({ ...filters, explicit: event.target.checked })}
        />
      </FilterRow>
    </FilterPanel>
  );
}
