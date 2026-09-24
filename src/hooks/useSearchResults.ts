/**
 * @file src/hooks/useSearchResults.ts
 * @desc Fetches /api/search for a search state, a moment after it last changed, dropping an
 *       answer that arrives after a newer search started. Keeps the last results while a new
 *       search loads; an error keeps them too and carries the route's message.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { useEffect, useState } from "react";
import { FETCH_DELAY_MS } from "@/constants/search";
import { type SearchResponse, type SearchState, serializeSearchState } from "@/utils/search-params";

export type SearchResults = {
  status: "loading" | "ready" | "error";
  data: SearchResponse | null;
  error: string | null;
};

const NETWORK_ERROR = "Search didn't load. Check your connection and try again.";

/**
 * @function useSearchResults
 * @param state {SearchState} the search
 * @returns {SearchResults} what the route said last
 */
export const useSearchResults = (state: SearchState): SearchResults => {
  const [results, setResults] = useState<SearchResults>({
    status: "loading",
    data: null,
    error: null,
  });
  const query = serializeSearchState(state);
  useEffect(() => {
    const controller = new AbortController();
    setResults((previous) => ({ ...previous, status: "loading", error: null }));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(query === "" ? "/api/search" : `/api/search?${query}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as SearchResponse | { error?: { message?: string } };
        if (controller.signal.aborted) return;
        if (!response.ok || !("results" in body)) {
          const message = "error" in body ? body.error?.message : undefined;
          setResults((previous) => ({
            ...previous,
            status: "error",
            error: message ?? NETWORK_ERROR,
          }));
          return;
        }
        setResults({ status: "ready", data: body, error: null });
      } catch {
        if (controller.signal.aborted) return;
        setResults((previous) => ({ ...previous, status: "error", error: NETWORK_ERROR }));
      }
    }, FETCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return results;
};
