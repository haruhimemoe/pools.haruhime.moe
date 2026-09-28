/**
 * @file src/components/builder/BrowseFilters.tsx
 * @desc The map browser's filters: the mod lens (the lenses the mirror offers; forced to NM for
 *       Qualified and Pending, which have no mod values, and it says so), the text, one status
 *       (radio chips), the sort (mod data only), the ranges under the lens, "hide maps in this
 *       pool" and "hide maps played in past pools", and explicit maps: a checkbox for Qualified
 *       and Pending, a line for the rest, whose mod searches can include them. Any change goes
 *       back to page 1. Presentational.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Checkbox, FilterPanel, FilterRow, Select, TextInput } from "@haruhimemoe/ui";
import type { ReactNode } from "react";
import { BrowseRanges } from "@/components/builder/BrowseRanges";
import { StatusChips } from "@/components/search/StatusChips";
import {
  BROWSE_SORT_LABELS,
  BROWSE_SORTS,
  type BrowseLens,
  type BrowseSort,
} from "@/constants/browse";
import { MAX_QUERY_LENGTH } from "@/constants/search";
import { type BrowseState, DEFAULT_BROWSE_STATE, isLensStatus, lensOf } from "@/utils/browse-state";

/** Said under a mod lens: values the mirror has no mod data for are worked out. */
export const NO_MOD_VALUES =
  "Mod values aren't available for Qualified and Pending maps, so these are without mods.";
/** Said instead of the explicit checkbox, which only Qualified and Pending have. */
export const EXPLICIT_LINE = "Mod searches can include explicit maps.";

type BrowseFiltersProps = {
  state: BrowseState;
  lenses: readonly string[];
  /** The lens the page on screen is under, for the range labels. */
  valuesLens: string;
  onChange: (next: BrowseState) => void;
  resultCount: ReactNode;
};

const isActive = (state: BrowseState): boolean => {
  const { q: _q, lens: _lens, page: _page, ...rest } = state;
  const { q: _dq, lens: _dl, page: _dp, ...defaults } = DEFAULT_BROWSE_STATE;
  return JSON.stringify(rest) !== JSON.stringify(defaults);
};

/**
 * @function BrowseFilters
 * @param props {BrowseFiltersProps} the browser's state, the lens and a change handler
 * @returns {JSX.Element} the text, status, lens, sort and explicit filters
 */
export function BrowseFilters(props: BrowseFiltersProps) {
  const { state, lenses, valuesLens, onChange, resultCount } = props;
  const set = (patch: Partial<BrowseState>) => onChange({ ...state, ...patch, page: 1 });
  const withMods = isLensStatus(state.status);
  const lens = lensOf(state);
  return (
    <FilterPanel
      title="Filters"
      headingLevel={3}
      resultCount={resultCount}
      active={isActive(state)}
      onClear={() => onChange({ ...DEFAULT_BROWSE_STATE, q: state.q, lens: state.lens })}
    >
      <FilterRow label="Mod lens">
        <Select
          id="browse-lens"
          label="Values under"
          value={lens}
          disabled={!withMods}
          hint={withMods ? undefined : NO_MOD_VALUES}
          onChange={(event) => set({ lens: event.target.value as BrowseLens })}
        >
          {(lenses.includes(lens) ? lenses : [lens, ...lenses]).map((code) => (
            <option key={code} value={code}>
              {code === "NM" ? "NM (no mods)" : code}
            </option>
          ))}
        </Select>
      </FilterRow>
      <FilterRow label="Search">
        <TextInput
          id="browse-q"
          label="Title, artist or mapper"
          value={state.q}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(event) => set({ q: event.target.value })}
        />
      </FilterRow>
      <FilterRow label="Status">
        <StatusChips value={state.status} onChange={(status) => set({ status })} />
      </FilterRow>
      {withMods ? (
        <FilterRow label="Sort">
          <Select
            id="browse-sort"
            label="Order"
            value={state.sort}
            onChange={(event) => set({ sort: event.target.value as BrowseSort })}
          >
            {BROWSE_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {BROWSE_SORT_LABELS[sort]}
              </option>
            ))}
          </Select>
        </FilterRow>
      ) : null}
      <BrowseRanges
        state={state}
        lens={valuesLens}
        onChange={(key, value) => set({ [key]: value })}
      />
      <FilterRow label="Hide">
        <div className="flex flex-col gap-2">
          <Checkbox
            id="browse-hide-in-pool"
            label="Hide maps in this pool"
            checked={state.hideInPool}
            onChange={(event) => set({ hideInPool: event.target.checked })}
          />
          <Checkbox
            id="browse-hide-played"
            label="Hide maps played in past pools"
            checked={state.hidePlayed}
            onChange={(event) => set({ hidePlayed: event.target.checked })}
          />
        </div>
      </FilterRow>
      <FilterRow label="Explicit">
        {withMods ? (
          <p className="text-c3 text-sm">{EXPLICIT_LINE}</p>
        ) : (
          <Checkbox
            id="browse-explicit"
            label="Show explicit maps"
            checked={state.explicit}
            onChange={(event) => set({ explicit: event.target.checked })}
          />
        )}
      </FilterRow>
    </FilterPanel>
  );
}
