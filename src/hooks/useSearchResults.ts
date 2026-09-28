/**
 * @file src/hooks/useSearchResults.ts
 * @desc Fetches /api/search for a search state, a moment after it last changed, dropping an
 *       answer that arrives after a newer search started. Keeps the last results while a new
 *       search loads; an error keeps them too and carries the route's message and code (null
 *       when the request didn't reach it).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { useEffect, useState } from "react";
import { FETCH_DELAY_MS } from "@/constants/search";
import type { SearchResponse } from "@/schemas/search-response";
import type { SearchState } from "@/utils/search-filters";
import { serializeSearchState } from "@/utils/search-params";

/** The search page's results: the answer on screen, its status, and retry. */
export type SearchResults = {
  status: "loading" | "ready" | "error";
  data: SearchResponse | null;
  error: string | null;
  /** The route's error code ("mirror_unavailable", "rate_limited", ...), when it sent one. */
  code: string | null;
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
    code: null,
  });
  const query = serializeSearchState(state);
  useEffect(() => {
    const controller = new AbortController();
    setResults((previous) => ({ ...previous, status: "loading", error: null, code: null }));
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(query === "" ? "/api/search" : `/api/search?${query}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as
          | SearchResponse
          | { error?: { message?: string; code?: string } };
        if (controller.signal.aborted) return;
        if (!response.ok || !("results" in body)) {
          const error = "error" in body ? body.error : undefined;
          setResults((previous) => ({
            ...previous,
            status: "error",
            error: error?.message ?? NETWORK_ERROR,
            code: error?.code ?? null,
          }));
          return;
        }
        setResults({ status: "ready", data: body, error: null, code: null });
      } catch {
        if (controller.signal.aborted) return;
        setResults((previous) => ({
          ...previous,
          status: "error",
          error: NETWORK_ERROR,
          code: null,
        }));
      }
    }, FETCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return results;
};
