/**
 * @file src/hooks/useMapBrowse.ts
 * @desc Fetches one page of the map browser (GET /api/maps/browse) a moment after its state last
 *       changed, dropping an answer that arrives after a newer search started. The pool's maps
 *       go out with a search ("hide maps in this pool") but adding one doesn't search again, so
 *       the page doesn't jump under the person adding. While a new search loads, the last page
 *       stays. A failure (the route's 503, a 429, no answer) drops it (no stale sets) and carries
 *       the route's message, else "Map search isn't working right now."; retry() asks again. Waits while `enabled` is false (the URL not read yet).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BROWSE_FAILED } from "@/constants/browse";
import { FETCH_DELAY_MS } from "@/constants/search";
import type { BrowseResponse } from "@/utils/browse-params";
import { type BrowseState, browseRequestUrl, editorSearchFor } from "@/utils/browse-state";

export type MapBrowse = {
  status: "loading" | "ready" | "error";
  data: BrowseResponse | null;
  error: string | null;
  retry: () => void;
};

type Options = { fetcher?: typeof fetch; enabled?: boolean; delayMs?: number };

const errorOf = (body: unknown): string | null => {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const { error } = body as { error?: { message?: unknown } };
  return typeof error?.message === "string" ? error.message : null;
};

/**
 * @function useMapBrowse
 * @param state {BrowseState} the browser's state
 * @param poolIds {readonly number[]} the pool's beatmap ids now
 * @param options {Options} fetch (tests), whether to search yet, and the wait
 * @returns {MapBrowse} what the route said last, and retry
 */
export const useMapBrowse = (
  state: BrowseState,
  poolIds: readonly number[],
  { fetcher = fetch, enabled = true, delayMs = FETCH_DELAY_MS }: Options = {},
): MapBrowse => {
  const [result, setResult] = useState<Omit<MapBrowse, "retry">>({
    status: "loading",
    data: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef({ state, poolIds });
  latest.current = { state, poolIds };
  const key = editorSearchFor("", state);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the state; `attempt` asks again.
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setResult((previous) => ({ ...previous, status: "loading", error: null }));
    const timer = setTimeout(async () => {
      const url = browseRequestUrl(latest.current.state, latest.current.poolIds);
      try {
        const response = await fetcher(url, { signal: controller.signal });
        const body: unknown = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok || typeof body !== "object" || body === null || !("sets" in body)) {
          setResult({ status: "error", data: null, error: errorOf(body) ?? BROWSE_FAILED });
          return;
        }
        setResult({ status: "ready", data: body as BrowseResponse, error: null });
      } catch {
        if (controller.signal.aborted) return;
        setResult({ status: "error", data: null, error: BROWSE_FAILED });
      }
    }, delayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt, enabled, fetcher, delayMs]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...result, retry };
};
