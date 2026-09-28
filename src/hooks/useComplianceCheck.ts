/**
 * @file src/hooks/useComplianceCheck.ts
 * @desc Asks /api/check about a list of beatmap ids (sorted, so everyone checking the same maps
 *       shares one CDN answer), dropping an answer that arrives after a newer check started, and
 *       offers a retry that asks again for the same ids (after a failed check, for maps that
 *       couldn't be checked, or when the same paste is checked again).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { CheckResponse } from "@/schemas/compliance";

/** The check's state: idle, running, its answer, or why it failed. */
export type ComplianceCheck =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: CheckResponse }
  | { status: "error"; message: string };

const FAILED = "The check didn't load. Check your connection and try again.";

/**
 * @function useComplianceCheck
 * @param ids {readonly number[]} ascending, distinct beatmap ids (none: nothing is asked)
 * @returns {{ check: ComplianceCheck; retry: () => void }} the answer so far, and a retry that
 *          asks again even when the ids haven't changed
 */
export const useComplianceCheck = (ids: readonly number[]) => {
  const [check, setCheck] = useState<ComplianceCheck>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const query = ids.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt asks again on a retry, even for the same ids
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
