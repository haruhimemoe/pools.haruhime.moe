/**
 * @file src/hooks/useComplianceCheck.ts
 * @desc Asks /api/check about a list of beatmap ids (sorted, so everyone checking the same maps
 *       shares one CDN answer), dropping an answer that arrives after a newer check started, and
 *       offers a retry for maps that couldn't be checked.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { CheckResponse } from "@/schemas/compliance";

export type ComplianceCheck =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: CheckResponse }
  | { status: "error"; message: string };

const FAILED = "The check didn't load. Check your connection and try again.";

/**
 * @function useComplianceCheck
 * @param ids {readonly number[]} ascending, distinct beatmap ids (none: nothing is asked)
 * @returns {{ check: ComplianceCheck; retry: () => void }} the answer so far and a retry
 */
export const useComplianceCheck = (ids: readonly number[]) => {
  const [check, setCheck] = useState<ComplianceCheck>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const query = ids.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt asks again when retry is pressed
  useEffect(() => {
    if (query === "") {
      setCheck({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setCheck({ status: "loading" });
    fetch(`/api/check?ids=${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as CheckResponse | { error?: { message?: string } };
        if (controller.signal.aborted) return;
        if (!response.ok || !("sets" in body)) {
          setCheck({
            status: "error",
            message: ("error" in body ? body.error?.message : undefined) ?? FAILED,
          });
          return;
        }
        setCheck({ status: "ready", result: body });
      })
      .catch(() => {
        if (!controller.signal.aborted) setCheck({ status: "error", message: FAILED });
      });
    return () => controller.abort();
  }, [query, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { check, retry };
};
