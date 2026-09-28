/**
 * @file src/hooks/useUndoSteps.ts
 * @desc The editor's undo bookkeeping, beside its queue of ops: each change of this session gets
 *       a step with its inverse (src/utils/undo.ts; a change with none cuts the history), each
 *       queued op remembers its step and whether it is an undo, a saved call marks its steps
 *       saved, and a dropped queue drops the steps that never saved; someone else's change
 *       clears them all. At most 20 steps.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { ClientPool } from "@/schemas/built-pool-view";
import { confirmSteps, dropUnsaved, inverseOf, pushStep, type UndoStep } from "@/utils/undo";

type Tag = { step: number | null; undo: boolean };

export const useUndoSteps = () => {
  const tags = useRef<Tag[]>([]);
  const history = useRef<UndoStep[]>([]);
  const nextStep = useRef(1);
  const [count, setCount] = useState(0);
  const set = useCallback((next: UndoStep[]) => {
    history.current = next;
    setCount(next.length);
  }, []);

  /** A change was queued: its step (not for an undo) and its ops' tags. */
  const queued = useCallback(
    (before: ClientPool, ops: readonly PoolOp[], undo: boolean) => {
      let step: number | null = null;
      if (!undo) {
        const inverse = inverseOf(before, ops);
        step = inverse ? nextStep.current++ : null;
        const entry = inverse && step ? { id: step, ops: inverse, saved: false } : null;
        set(entry ? pushStep(history.current, entry) : []);
      }
      tags.current.push(...ops.map(() => ({ step, undo })));
    },
    [set],
  );

  /** A call took the first `n` queued ops: whether one was an undo. */
  const sent = useCallback((n: number) => {
    const taken = tags.current.splice(0, n);
    const steps = taken.flatMap((tag) => (tag.step === null ? [] : [tag.step]));
    return { steps, undoing: taken.some((tag) => tag.undo) };
  }, []);

  const saved = useCallback((steps: number[]) => set(confirmSteps(history.current, steps)), [set]);

  /** The queue was dropped: steps whose change never saved go. */
  const dropped = useCallback(() => {
    tags.current = [];
    set(dropUnsaved(history.current));
  }, [set]);

  /** Someone else changed the pool: no step can go back safely any more. */
  const clear = useCallback(() => set([]), [set]);

  /** Takes the last step off the history. */
  const pop = useCallback((): UndoStep | undefined => {
    const step = history.current.at(-1);
    if (step) set(history.current.slice(0, -1));
    return step;
  }, [set]);

  return useMemo(
    () => ({ count, queued, sent, saved, dropped, clear, pop }),
    [count, queued, sent, saved, dropped, clear, pop],
  );
};
