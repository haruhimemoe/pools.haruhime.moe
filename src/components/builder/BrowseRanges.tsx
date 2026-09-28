/**
 * @file src/components/builder/BrowseRanges.tsx
 * @desc The map browser's range filters, each under the lens and named with it: star rating,
 *       BPM, length, AR and OD, on the search page's own range sliders (open-ended at the top).
 *       Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { formatDuration, formatStars } from "@haruhimemoe/osu/format";
import { FilterRow, RangeSlider } from "@haruhimemoe/ui";
import {
  AR_RANGE,
  BPM_RANGE,
  type FilterBounds,
  LENGTH_RANGE,
  OD_RANGE,
  STAR_RANGE,
} from "@/constants/search";
import type { BrowseState } from "@/utils/browse-state";
import type { Range } from "@/utils/search-filters";
import { normalizeRange, parseLengthText } from "@/utils/search-ranges";

type RangeKey = "sr" | "bpm" | "len" | "ar" | "od";

const RANGES: readonly {
  key: RangeKey;
  name: string;
  bounds: FilterBounds;
  format?: (n: number) => string;
  parse?: (text: string) => number | null;
}[] = [
  { key: "sr", name: "Stars", bounds: STAR_RANGE, format: formatStars },
  { key: "bpm", name: "BPM", bounds: BPM_RANGE },
  {
    key: "len",
    name: "Length",
    bounds: LENGTH_RANGE,
    format: formatDuration,
    parse: parseLengthText,
  },
  { key: "ar", name: "AR", bounds: AR_RANGE },
  { key: "od", name: "OD", bounds: OD_RANGE },
];

type BrowseRangesProps = {
  state: BrowseState;
  /** The lens the values are under, for the labels. */
  lens: string;
  onChange: (key: RangeKey, value: Range | null) => void;
};

export function BrowseRanges({ state, lens, onChange }: BrowseRangesProps) {
  return RANGES.map(({ key, name, bounds, format, parse }) => (
    <FilterRow key={key} label={`${name} (${lens})`}>
      <RangeSlider
        label={`${name} under ${lens}`}
        hideLabel
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        openEnded
        format={format}
        parse={parse}
        value={state[key] ?? [bounds.min, null]}
        onChange={(value) => onChange(key, normalizeRange(value, bounds))}
      />
    </FilterRow>
  ));
}
