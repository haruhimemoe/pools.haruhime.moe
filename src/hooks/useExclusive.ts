/**
 * @file src/hooks/useExclusive.ts
 * @desc Requests that take turns: each task starts once the one before it settles (resolved or
 *       not), so the editor never sends a call with a version another one just moved on.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { useCallback, useRef } from "react";

/**
 * @function useExclusive
 * @returns {<T>(task: () => Promise<T>) => Promise<T>} runs a task after every task before it,
 *          with the task's own result
 */
export const useExclusive = () => {
  const lock = useRef<Promise<unknown>>(Promise.resolve());
  return useCallback(<T>(task: () => Promise<T>): Promise<T> => {
    const run = lock.current.then(task, task);
    lock.current = run.catch(() => undefined);
    return run;
  }, []);
};
