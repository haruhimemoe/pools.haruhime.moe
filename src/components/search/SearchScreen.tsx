/**
 * @file src/components/search/SearchScreen.tsx
 * @desc The search page: Pools and Maps tabs, the tab's filter bar, the results and pages. The
 *       URL is the state: it's read on load and on Back/Forward, and written (replaceState, a
 *       moment after the last change) as filters change, so a search can be shared. Results
 *       come from /api/search. Filter changes go back to page 1.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { Notice, PageHeader, Pagination } from "@haruhimemoe/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapFilterPanel } from "@/components/search/MapFilterPanel";
import { MapResultList } from "@/components/search/MapResultList";
import { PoolFilterPanel } from "@/components/search/PoolFilterPanel";
import { PoolResultList } from "@/components/search/PoolResultList";
import { URL_WRITE_MS } from "@/constants/search";
import { useSearchResults } from "@/hooks/useSearchResults";
import {
  EMPTY_MAP_FILTERS,
  EMPTY_POOL_FILTERS,
  parseSearchState,
  type SearchState,
  searchHref,
  serializeSearchState,
} from "@/utils/search-params";

const countText = (total: number, tab: SearchState["tab"]): string => {
  const noun = tab === "pools" ? "pool" : "map";
  return `${total} ${total === 1 ? noun : `${noun}s`}`;
};

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
  const data = results.data?.tab === state.tab ? results.data : null;
  const count = data ? countText(data.total, state.tab) : "Loading…";
  const mapError =
    state.tab === "pools" && state.filters.map !== "" && results.status === "error"
      ? results.error
      : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Search"
        lead="Past osu! tournament pools and their maps. Star ratings are without mods."
      />
      <nav aria-label="What to search" className="flex gap-4 font-bold">
        {(["pools", "maps"] as const).map((tab) => (
          <Link
            key={tab}
            href={searchHref(
              tab === "pools"
                ? { tab, page: 1, filters: { ...EMPTY_POOL_FILTERS, q: state.filters.q } }
                : { tab, page: 1, filters: { ...EMPTY_MAP_FILTERS, q: state.filters.q } },
            )}
            aria-current={state.tab === tab ? "page" : undefined}
            className={
              state.tab === tab ? "text-c1 underline underline-offset-4" : "text-c3 hover:text-c1"
            }
          >
            {tab === "pools" ? "Pools" : "Maps"}
          </Link>
        ))}
      </nav>
      {state.tab === "pools" ? (
        <PoolFilterPanel
          filters={state.filters}
          onChange={(filters) => setState({ tab: "pools", page: 1, filters })}
          badgedKnown={data?.tab === "pools" ? data.badgedKnown : false}
          resultCount={count}
          mapError={mapError}
        />
      ) : (
        <MapFilterPanel
          filters={state.filters}
          onChange={(filters) => setState({ tab: "maps", page: 1, filters })}
          resultCount={count}
        />
      )}
      {results.status === "error" && mapError === null ? (
        <Notice tone="error" live>
          {results.error}
        </Notice>
      ) : null}
      {data && data.hiddenMissing > 0 ? (
        <p className="text-c3 text-sm">
          {data.hiddenMissing} more hidden: data missing for a filter.
        </p>
      ) : null}
      {data?.tab === "pools" ? <PoolResultList results={data.results} /> : null}
      {data?.tab === "maps" ? <MapResultList results={data.results} /> : null}
      {data && data.total === 0 ? (
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
