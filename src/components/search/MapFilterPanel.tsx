/**
 * @file src/components/search/MapFilterPanel.tsx
 * @desc The maps filter bar: text, star rating without mods, length, BPM, AR, OD, CS, played as
 *       (a map needs every ticked code), times used, last used year, and the sort.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { ChipGroup, FilterPanel, FilterRow, RangeSlider, Select, TextInput } from "@haruhimemoe/ui";
import type { ReactNode } from "react";
import { PLAYED_AS_CODES, type PlayedAsCode } from "@/constants/pools";
import {
  AR_RANGE,
  BPM_RANGE,
  CS_RANGE,
  type FilterBounds,
  LENGTH_RANGE,
  MAP_SORT_LABELS,
  MAP_SORTS,
  MAX_QUERY_LENGTH,
  type MapSort,
  OD_RANGE,
  STAR_RANGE,
  USED_RANGE,
  YEAR_RANGE,
} from "@/constants/search";
import { formatDuration, formatStars } from "@/utils/format";
import {
  EMPTY_MAP_FILTERS,
  hasMapFilters,
  type MapFilters,
  normalizeRange,
  parseLengthText,
  type Range,
} from "@/utils/search-params";

type Props = { filters: MapFilters; onChange: (next: MapFilters) => void; resultCount: ReactNode };

type RangeKey = "sr" | "len" | "bpm" | "ar" | "od" | "cs" | "used" | "last";

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
  { key: "ar", row: "AR", label: "Approach rate", bounds: AR_RANGE },
  { key: "od", row: "OD", label: "Overall difficulty", bounds: OD_RANGE },
  { key: "cs", row: "CS", label: "Circle size", bounds: CS_RANGE },
  { key: "used", row: "Times used", label: "Times used", bounds: USED_RANGE },
  { key: "last", row: "Last used", label: "Last used year", bounds: YEAR_RANGE },
];

export function MapFilterPanel({ filters, onChange, resultCount }: Props) {
  const setRange = (key: RangeKey, value: Range | null) => onChange({ ...filters, [key]: value });
  return (
    <FilterPanel
      title="Filter maps"
      resultCount={resultCount}
      active={hasMapFilters(filters)}
      onClear={() => onChange({ ...EMPTY_MAP_FILTERS, q: filters.q, sort: filters.sort })}
    >
      <FilterRow label="Search">
        <TextInput
          id="maps-q"
          label="Title, artist, set host or difficulty"
          value={filters.q}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
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
      <FilterRow label="Played as">
        <ChipGroup
          label="Played as"
          hideLabel
          options={PLAYED_AS_CODES.map((code) => ({ value: code, label: code }))}
          value={filters.played}
          onChange={(value) => onChange({ ...filters, played: value as PlayedAsCode[] })}
        />
      </FilterRow>
      <FilterRow label="Sort">
        <Select
          id="maps-sort"
          label="Sort maps"
          value={filters.sort}
          onChange={(event) => onChange({ ...filters, sort: event.target.value as MapSort })}
        >
          {MAP_SORTS.map((value) => (
            <option key={value} value={value}>
              {MAP_SORT_LABELS[value]}
            </option>
          ))}
        </Select>
      </FilterRow>
    </FilterPanel>
  );
}
