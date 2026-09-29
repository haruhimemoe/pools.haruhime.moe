/**
 * @file src/components/search/SearchScreen.tsx
 * @desc The search page: Pools and Maps tabs, the tab's filter bar, the results and pages. The
 *       URL is the state (the pools tab's type too: past tournament pools, built here, or both):
 *       it's read on load and on Back/Forward, and written (replaceState, a
 *       moment after the last change) as filters change, so a search can be shared. Results
 *       come from /api/search. Filter changes go back to page 1. The maps tab searches all osu!
 *       maps by default (hidden sets counted, the unranked line, both also read out with the
 *       live count; a failure shows no stale sets and, when the mirror is down, links the same
 *       search in maps played in pools) or maps played in pools. A failed search's count says
 *       so instead of "Loading…"; with no total the count says the page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { LinkTabs, Notice, PageHeader, Pagination } from "@haruhimemoe/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AllMapFilterPanel } from "@/components/search/AllMapFilterPanel";
import { AllMapResultList } from "@/components/search/AllMapResultList";
import { MapFilterPanel } from "@/components/search/MapFilterPanel";
import { MapResultList } from "@/components/search/MapResultList";
import { MapScopeSwitch } from "@/components/search/MapScopeSwitch";
import { PoolFilterPanel } from "@/components/search/PoolFilterPanel";
import { PoolResultList } from "@/components/search/PoolResultList";
import {
  hiddenSetsText,
  MIRROR_UNAVAILABLE_CODE,
  SEARCH_FAILED_COUNT,
  SEARCH_HEADING,
  SEARCH_LEAD,
  UNRANKED_WARNING,
  URL_WRITE_MS,
} from "@/constants/search";
import { useSearchResults } from "@/hooks/useSearchResults";
import {
  EMPTY_ALL_MAP_FILTERS,
  EMPTY_POOL_FILTERS,
  type SearchState,
} from "@/utils/search-filters";
import { scopeHref } from "@/utils/search-links";
import { parseSearchState, searchHref, serializeSearchState } from "@/utils/search-params";

/** Pools, maps played in pools, or beatmapsets (all maps; with no total, the page). */
const countText = (total: number | null, page: number, state: SearchState): string => {
  if (total === null) return `Page ${page}`;
  const noun = state.tab === "pools" ? "pool" : state.scope === "all" ? "set" : "map";
  return `${total} ${total === 1 ? noun : `${noun}s`}`;
};

/** The same kind of search as the answer: tab, and the maps tab's scope. */
const kindOf = (value: { tab: string; scope?: string }): string =>
  value.tab === "maps" ? `maps:${value.scope}` : value.tab;

/**
 * @function SearchScreen
 * @returns {JSX.Element} the search page: tabs, filters, results and paging, all in the URL
 */
export function SearchScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = useMemo(() => parseSearchState(params.toString()), [params]);
  const [state, setState] = useState<SearchState>(fromUrl);
  const written = useRef(serializeSearchState(fromUrl));

  // The URL changed under us (Back, Forward, a tab or page link): take its state.
  useEffect(() => {
    const text = serializeSearchState(fromUrl);
    if (text !== written.current) {
      written.current = text;
      setState(fromUrl);
    }
  }, [fromUrl]);

  // A Built here link with badged or stars reads without them: say so in the URL too.
  useEffect(() => {
    const built = fromUrl.tab === "pools" && fromUrl.filters.type === "built";
    if (!built || !(params.has("sr") || params.has("badged"))) return;
    const text = serializeSearchState(fromUrl);
    router.replace(text === "" ? "/search" : `/search?${text}`, { scroll: false });
  }, [fromUrl, params, router]);

  // Our state changed: write the URL once changes stop.
  useEffect(() => {
    const text = serializeSearchState(state);
    if (text === written.current) return;
    const timer = setTimeout(() => {
      written.current = text;
      router.replace(text === "" ? "/search" : `/search?${text}`, { scroll: false });
    }, URL_WRITE_MS);
    return () => clearTimeout(timer);
  }, [state, router]);

  const results = useSearchResults(state);
  const failed = results.status === "error";
  const allMaps = state.tab === "maps" && state.scope === "all";
  // A failed all-maps search shows no stale sets, hidden count or unranked line.
  const data =
    results.data && kindOf(results.data) === kindOf(state) && !(allMaps && failed)
      ? results.data
      : null;
  const count = failed
    ? SEARCH_FAILED_COUNT
    : data
      ? countText(data.total, data.page, state)
      : "Loading…";
  const hiddenText =
    data && "hidden" in data && data.hidden > 0 ? hiddenSetsText(data.hidden) : null;
  const unranked = data && "hidden" in data && data.results.some((set) => set.unranked);
  const spoken = [hiddenText, unranked ? UNRANKED_WARNING : null].filter(Boolean).join(". ");
  const allCount = (
    <>
      {count}
      {spoken ? <span className="sr-only">. {spoken}</span> : null}
    </>
  );
  const mapError =
    state.tab === "pools" && state.filters.map !== "" && results.status === "error"
      ? results.error
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={SEARCH_HEADING} lead={SEARCH_LEAD} />
      <LinkTabs
        label="What to search"
        items={(["pools", "maps"] as const).map((tab) => ({
          href: searchHref(
            tab === "pools"
              ? { tab, page: 1, filters: { ...EMPTY_POOL_FILTERS, q: state.filters.q } }
              : {
                  tab,
                  scope: "all",
                  page: 1,
                  filters: { ...EMPTY_ALL_MAP_FILTERS, q: state.filters.q },
                },
          ),
          label: tab === "pools" ? "Pools" : "Maps",
          current: state.tab === tab,
        }))}
      />
      {state.tab === "pools" ? (
        <PoolFilterPanel
          filters={state.filters}
          onChange={(filters) => setState({ tab: "pools", page: 1, filters })}
          badgedKnown={data?.tab === "pools" ? data.badgedKnown : false}
          resultCount={count}
          mapError={mapError}
        />
      ) : (
        <>
          <MapScopeSwitch scope={state.scope} filters={state.filters} />
          {state.scope === "all" ? (
            <AllMapFilterPanel
              filters={state.filters}
              onChange={(filters) => setState({ tab: "maps", scope: "all", page: 1, filters })}
              resultCount={allCount}
            />
          ) : (
            <MapFilterPanel
              filters={state.filters}
              onChange={(filters) => setState({ tab: "maps", scope: "played", page: 1, filters })}
              resultCount={count}
            />
          )}
        </>
      )}
      {results.status === "error" && mapError === null ? (
        <Notice tone="error" live>
          {results.error}
          {allMaps && results.code === MIRROR_UNAVAILABLE_CODE ? (
            <>
              {" "}
              <Link href={scopeHref("played", state.filters)} className="underline">
                Search maps played in pools
              </Link>
            </>
          ) : null}
        </Notice>
      ) : null}
      {data && "hiddenMissing" in data && data.hiddenMissing > 0 ? (
        <p className="text-c3 text-sm">
          {data.hiddenMissing} more hidden: data missing for a filter.
        </p>
      ) : null}
      {hiddenText ? <p className="text-c3 text-sm">{hiddenText}</p> : null}
      {unranked ? <p className="text-amber-200 text-sm">{UNRANKED_WARNING}</p> : null}
      {data?.tab === "pools" ? <PoolResultList results={data.results} /> : null}
      {data?.tab === "maps" && data.scope === "played" ? (
        <MapResultList results={data.results} />
      ) : null}
      {data?.tab === "maps" && data.scope === "all" ? (
        <AllMapResultList results={data.results} />
      ) : null}
      {data && data.results.length === 0 && !("hidden" in data && data.hidden > 0) ? (
        <p className="text-c3">Nothing matches. Try fewer filters.</p>
      ) : null}
      {data ? (
        <Pagination
          page={state.page}
          pageCount={data.pageCount}
          hrefFor={(page) => searchHref({ ...state, page } as SearchState)}
        />
      ) : null}
    </div>
  );
}
