/**
 * @file src/hooks/useSimilarMaps.ts
 * @desc Asks GET /api/maps/<id>/similar for the map browser's "Similar to" source whenever the
 *       map, the lens, the star range or the pool changes (only the newest answer counts), and
 *       again on Retry.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { callPools, type Fetcher } from "@/lib/pool-client";
import { type SimilarQuery, type SimilarResponse, similarApiUrl } from "@/utils/similar-params";

/** The source's state: loading (keeping the last answer), the answer, or a failure's message. */
export type SimilarMaps =
  | { status: "loading"; data: SimilarResponse | null }
  | { status: "ok"; data: SimilarResponse }
  | { status: "error"; data: null; message: string };

/**
 * @function useSimilarMaps
 * @param id {number} the map
 * @param query {SimilarQuery} the lens, star range and pool
 * @param fetcher {Fetcher} fetch (tests)
 * @returns {SimilarMaps & { retry: () => void }} the answer as far as it's known, and Retry
 */
export const useSimilarMaps = (
  id: number,
  query: SimilarQuery,
  fetcher: Fetcher = fetch,
): SimilarMaps & { retry: () => void } => {
  const [state, setState] = useState<SimilarMaps>({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);
  const path = similarApiUrl(id, query);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` asks again on purpose.
  useEffect(() => {
    const call = ++latest.current;
    setState((was) => ({ status: "loading", data: was.data }));
    void callPools<SimilarResponse>(fetcher, path).then((answer) => {
      if (call !== latest.current) return;
      setState(
        answer.ok
          ? { status: "ok", data: answer.body }
          : { status: "error", data: null, message: answer.message },
      );
    });
  }, [path, attempt, fetcher]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
};
