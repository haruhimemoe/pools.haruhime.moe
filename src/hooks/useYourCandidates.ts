/**
 * @file src/hooks/useYourCandidates.ts
 * @desc "Your candidates" in the editor's map browser: asks GET /api/candidates for the pool
 *       being edited with the current bucket (stars under its mods), the bucket filter, text,
 *       whether picks come too and the page, a moment after typing stops (300 ms) and at once
 *       for anything else; an answer to an older query is dropped. It asks again when `refresh`
 *       changes (a candidate was added, so the list has a new row).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { callPools, type Fetcher } from "@/lib/pool-client";
import type { YourCandidatesAnswer } from "@/schemas/your-candidates";

/** What the source asks for. */
export type YourCandidatesFilters = {
  bucket: string | null;
  q: string;
  picks: boolean;
  page: number;
};

/** The source's state: loading, the answer, or a failure's message. */
export type YourCandidates =
  | { status: "loading"; data: YourCandidatesAnswer | null }
  | { status: "ok"; data: YourCandidatesAnswer }
  | { status: "error"; data: null; message: string };

const TYPING_MS = 300;

/**
 * @function useYourCandidates
 * @param poolId {string} the pool being edited
 * @param under {string} the bucket whose mods the stars are under
 * @param filters {YourCandidatesFilters} the filters and page
 * @param refresh {number} changes when the list should be asked for again
 * @param fetcher {Fetcher} fetch (tests)
 * @returns {YourCandidates} the list as far as it's known
 */
export const useYourCandidates = (
  poolId: string,
  under: string,
  filters: YourCandidatesFilters,
  refresh: number,
  fetcher: Fetcher = fetch,
): YourCandidates => {
  const [state, setState] = useState<YourCandidates>({ status: "loading", data: null });
  const latest = useRef(0);
  const params = new URLSearchParams({ pool: poolId, under, page: String(filters.page) });
  if (filters.bucket) params.set("bucket", filters.bucket);
  if (filters.picks) params.set("picks", "1");
  const q = filters.q.trim();
  if (q) params.set("q", q);
  const path = `/api/candidates?${params}`;
  const typed = useRef(q);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `refresh` asks again on purpose.
  useEffect(() => {
    const call = ++latest.current;
    const wait = typed.current === q ? 0 : TYPING_MS;
    typed.current = q;
    setState((was) => ({ status: "loading", data: was.data }));
    const timer = setTimeout(() => {
      void callPools<YourCandidatesAnswer>(fetcher, path).then((answer) => {
        if (call !== latest.current) return;
        setState(
          answer.ok
            ? { status: "ok", data: answer.body }
            : { status: "error", data: null, message: answer.message },
        );
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [path, refresh, fetcher]);
  return state;
};
