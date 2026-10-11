/**
 * @file src/components/search/AllMapFilterPanel.tsx
 * @desc Filters for searching every osu! map: the text, one status at a time as a radio group
 *       (Ranked by default, which includes approved; Loved, Qualified, Pending, Graveyard), star
 *       rating
 *       (no mod), length and BPM ranges, and Show explicit maps (hidden unless ticked).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sat Sep 26, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { formatDuration, formatStars } from "@haruhimemoe/osu/format";
import { Checkbox, FilterPanel, FilterRow, RangeSlider, TextInput } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { StatusChips } from "@/components/search/StatusChips";
import {
  BPM_RANGE,
  type FilterBounds,
  LENGTH_RANGE,
  MAX_QUERY_LENGTH,
  STAR_RANGE,
} from "@/constants/search";
import {
  type AllMapFilters,
  EMPTY_ALL_MAP_FILTERS,
  hasAllMapFilters,
  type Range,
} from "@/utils/search-filters";
import { normalizeRange, parseLengthText } from "@/utils/search-ranges";

/** A translator: next-intl's t for this file's catalog keys. */
type T = (key: string, values?: Record<string, string | number>) => string;

type Props = {
  filters: AllMapFilters;
  onChange: (next: AllMapFilters) => void;
  resultCount: ReactNode;
};

type RangeKey = "sr" | "len" | "bpm";

type RangeRow = {
  key: RangeKey;
  row: string;
  label: string;
  bounds: FilterBounds;
  format?: (n: number) => string;
  parse?: (text: string) => number | null;
};

const RANGES = (t: T): readonly RangeRow[] => [
  {
    key: "sr",
    row: t("starsNoMod"),
    label: t("starRatingWithoutMods"),
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

/**
 * @function AllMapFilterPanel
 * @param props {Props} the filters, the change handler and the result count
 * @returns {JSX.Element} the all-maps filters: text, status, stars, length and BPM
 */
export function AllMapFilterPanel({ filters, onChange, resultCount }: Props) {
  const t = useTranslations("pools.allMapFilterPanel");
  const setRange = (key: RangeKey, value: Range | null) => onChange({ ...filters, [key]: value });
  return (
    <FilterPanel
      title={t("filterMaps")}
      resultCount={resultCount}
      active={hasAllMapFilters(filters)}
      onClear={() => onChange({ ...EMPTY_ALL_MAP_FILTERS, q: filters.q })}
    >
      <FilterRow label={t("search")}>
        <TextInput
          id="all-maps-q"
          label={t("titleArtistOrMapper")}
          value={filters.q}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </FilterRow>
      <FilterRow label={t("status")}>
        <StatusChips
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
        />
      </FilterRow>
      {RANGES(t).map(({ key, row, label, bounds, format, parse }) => (
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
      <FilterRow label={t("explicit")}>
        <Checkbox
          id="all-maps-explicit"
          label={t("showExplicitMaps")}
          checked={filters.explicit}
          onChange={(event) => onChange({ ...filters, explicit: event.target.checked })}
        />
      </FilterRow>
    </FilterPanel>
  );
}
