/**
 * @file src/hooks/usePoolPolling.ts
 * @desc While the editor is open and its tab is shown, it asks for the pool every 15 s and on
 *       window focus, in turn with the ops. A pool that's gone stays gone: no more asking.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { useEffect } from "react";

/**
 * @function usePoolPolling
 * @param check {() => void} asks for the pool (in turn with the ops)
 * @param pollMs {number} how often
 * @param stopped {boolean} the pool is gone: stop asking
 * @returns {void}
 */
export const usePoolPolling = (check: () => void, pollMs: number, stopped: boolean): void => {
  useEffect(() => {
    if (stopped) return;
    const tick = () => {
      if (document.visibilityState !== "hidden") check();
    };
    const timer = window.setInterval(tick, pollMs);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [check, pollMs, stopped]);
};
