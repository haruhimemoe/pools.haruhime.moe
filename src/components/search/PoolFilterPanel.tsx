/**
 * @file src/components/search/PoolFilterPanel.tsx
 * @desc The pools filter bar: which pools (past tournament pools, built here, or both, as
 *       chips that are a real radio group), text, year, badged (only once some pool knows it)
 *       and star rating without mods (neither for built pools only: they have no such data, so
 *       picking Built here clears both and says so), map count, a contained map (with the
 *       route's message when it can't be read), and the sort. Clear keeps the type, the text
 *       and the sort.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { formatStars } from "@haruhimemoe/osu/format";
import {
  ChoiceChips,
  FilterPanel,
  FilterRow,
  RangeSlider,
  Select,
  TextInput,
} from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import {
  BADGED_FILTERS,
  BADGED_LABELS,
  type BadgedFilter,
  BUILT_CLEARED_NOTE,
  MAP_COUNT_RANGE,
  MAX_MAP_REF_LENGTH,
  MAX_QUERY_LENGTH,
  POOL_SORT_LABELS,
  POOL_SORTS,
  POOL_TYPE_LABELS,
  POOL_TYPES,
  type PoolSort,
  type PoolType,
  STAR_RANGE,
  YEAR_RANGE,
} from "@/constants/search";
import { EMPTY_POOL_FILTERS, hasPoolFilters, type PoolFilters } from "@/utils/search-filters";
import { normalizeRange } from "@/utils/search-ranges";

type Props = {
  filters: PoolFilters;
  onChange: (next: PoolFilters) => void;
  badgedKnown: boolean;
  resultCount: ReactNode;
  mapError: string | null;
};

/**
 * @function PoolFilterPanel
 * @param props {Props} the filters, the change handler, whether badged is known, the count and a
 *        map error
 * @returns {JSX.Element} the pools filters: type, text, map, year, badged, stars, map count and
 *          sort
 */
export function PoolFilterPanel({ filters, onChange, badgedKnown, resultCount, mapError }: Props) {
  const t = useTranslations("pools.poolFilterPanel");
  const set = <K extends keyof PoolFilters>(key: K, value: PoolFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const [cleared, setCleared] = useState(false);
  const setType = (type: PoolType) => {
    const drops = type === "built" && (filters.badged !== "any" || filters.sr !== null);
    setCleared(drops || (cleared && type === "built"));
    onChange(
      type === "built" ? { ...filters, type, badged: "any", sr: null } : { ...filters, type },
    );
  };
  // Built pools have no badged or star stats: those filters would match none of them.
  const builtOnly = filters.type === "built";
  return (
    <FilterPanel
      title={t("filterPools")}
      resultCount={resultCount}
      active={hasPoolFilters(filters)}
      onClear={() =>
        onChange({ ...EMPTY_POOL_FILTERS, type: filters.type, q: filters.q, sort: filters.sort })
      }
    >
      <FilterRow label={t("pools")}>
        <div className="flex flex-col gap-2">
          <ChoiceChips
            label={t("pools")}
            hideLabel
            options={POOL_TYPES.map((type) => ({ value: type, label: POOL_TYPE_LABELS[type] }))}
            value={filters.type}
            onChange={setType}
          />
          <output aria-live="polite" className="text-c3 text-xs">
            {cleared ? BUILT_CLEARED_NOTE : ""}
          </output>
        </div>
      </FilterRow>
      <FilterRow label={t("search")}>
        <TextInput
          id="pools-q"
          label={t("tournamentRoundOrPool")}
          value={filters.q}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(event) => set("q", event.target.value)}
        />
      </FilterRow>
      <FilterRow label={t("year")}>
        <RangeSlider
          label={t("year")}
          hideLabel
          min={YEAR_RANGE.min}
          max={YEAR_RANGE.max}
          step={YEAR_RANGE.step}
          openEnded
          value={filters.year ?? [YEAR_RANGE.min, null]}
          onChange={(value) => set("year", normalizeRange(value, YEAR_RANGE))}
        />
      </FilterRow>
      {badgedKnown && !builtOnly ? (
        <FilterRow label={t("badged")}>
          <Select
            id="pools-badged"
            label={t("badged")}
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
      {builtOnly ? null : (
        <FilterRow label={t("starsNoMod")}>
          <RangeSlider
            label={t("starRatingWithoutMods")}
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
      )}
      <FilterRow label={t("maps")}>
        <RangeSlider
          label={t("numberOfMaps")}
          hideLabel
          min={MAP_COUNT_RANGE.min}
          max={MAP_COUNT_RANGE.max}
          step={MAP_COUNT_RANGE.step}
          openEnded
          value={filters.maps ?? [MAP_COUNT_RANGE.min, null]}
          onChange={(value) => set("maps", normalizeRange(value, MAP_COUNT_RANGE))}
        />
      </FilterRow>
      <FilterRow label={t("hasMap")}>
        <TextInput
          id="pools-map"
          label={t("beatmapIdOrLink")}
          value={filters.map}
          maxLength={MAX_MAP_REF_LENGTH}
          error={mapError ?? undefined}
          onChange={(event) => set("map", event.target.value)}
        />
      </FilterRow>
      <FilterRow label={t("sort")}>
        <Select
          id="pools-sort"
          label={t("sortPools")}
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
