/**
 * @file src/hooks/usePoolEditor.ts
 * @desc The editor's copy of a pool and its saving. A change applies at once to the copy
 *       (src/utils/built-editor.ts, the server's own rules) and queues its ops; one call at a
 *       time sends everything queued (at most 20 ops) with the last saved version. An error puts
 *       the copy back to the last saved pool and says why (a paste's bad lines too); a 409 takes
 *       the pool the server sent and says someone else changed it. Other requests (visibility,
 *       editors) take turns with the ops through `exclusive`, so no call is ever made with a
 *       version another one just moved on. While open it asks for the version every 15 s and
 *       on window focus, and takes a newer pool (a conflict when changes are still queued), or
 *       only the pack's state when a sync moved it on the same version. A
 *       404 (or 401) from a read or a save means the pool was deleted or access went: it says
 *       so once and stops asking. Undo sends the inverse of this session's last change
 *       (src/utils/undo.ts; up to 20 steps, no redo) as a change of its own; a 409 on it drops
 *       that step with a notice, and a step that no longer applies is dropped too. Someone
 *       else's change (a pool whose content differs from the last saved one, from a poll, a 409
 *       or another request's answer) ends the whole history: steps name slots by place, so one
 *       sent after it could undo their work instead.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_OPS_PER_CALL } from "@/constants/built-pools";
import { POLL_MS, UNDO_DROPPED, UNDO_STALE } from "@/constants/editor";
import { useExclusive } from "@/hooks/useExclusive";
import { usePoolPolling } from "@/hooks/usePoolPolling";
import { useUndoSteps } from "@/hooks/useUndoSteps";
import { callPools, type Fetcher, UNREACHABLE } from "@/lib/pool-client";
import type { PoolOp } from "@/schemas/built-pool-ops";
import { type ClientPack, type ClientPool, clientPoolOf } from "@/schemas/built-pool-view";
import type { EditorFailure, PoolEditor } from "@/schemas/pool-editor";
import { applyLocal } from "@/utils/built-editor";
import { sameContent } from "@/utils/undo";

type PoolBody = { pool: ClientPool };

const samePack = (a: ClientPack, b: ClientPack): boolean =>
  a.state === b.state && a.href === b.href && a.error === b.error && a.gone === b.gone;

/**
 * @function usePoolEditor
 * @param initial {ClientPool} the pool as the page read it
 * @param options {{ fetcher?: Fetcher; pollMs?: number }} fetch and the poll interval (tests)
 * @returns {PoolEditor} the copy on screen and the calls that change and save it
 */
export const usePoolEditor = (
  initial: ClientPool,
  { fetcher = fetch, pollMs = POLL_MS }: { fetcher?: Fetcher; pollMs?: number } = {},
): PoolEditor => {
  const [pool, setPool] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<EditorFailure | null>(null);
  const [conflict, setConflict] = useState(false);
  const [gone, setGone] = useState(false);
  const saved = useRef(initial);
  const view = useRef(initial);
  const queue = useRef<PoolOp[]>([]);
  const steps = useUndoSteps();
  const exclusive = useExclusive();

  /** Nothing queued any more: steps whose change never saved can't be undone. */
  const dropQueue = useCallback(() => {
    queue.current = [];
    steps.dropped();
  }, [steps]);

  const show = useCallback((next: ClientPool) => {
    view.current = next;
    setPool(next);
  }, []);

  /** The saved pool with whatever is still queued on top (dropped if it no longer applies). */
  const rebase = useCallback(
    (next: ClientPool) => {
      saved.current = next;
      const local = applyLocal(next, queue.current);
      if (!local.ok) dropQueue();
      show(local.ok ? local.pool : next);
    },
    [show, dropQueue],
  );

  const rollBack = useCallback(
    (next: ClientPool, why: EditorFailure | "conflict") => {
      dropQueue();
      rebase(next);
      if (why === "conflict") setConflict(true);
      else setFailure(why);
    },
    [rebase, dropQueue],
  );

  const flush = useCallback(async () => {
    const ops = queue.current.splice(0, MAX_OPS_PER_CALL);
    const sent = steps.sent(ops.length);
    if (ops.length === 0) {
      setSaving(false);
      return;
    }
    const path = `/api/pools/${saved.current.id}/ops`;
    const body = { baseVersion: saved.current.version, ops };
    const answer = await callPools<PoolBody>(fetcher, path, { method: "POST", body });
    if (answer.ok) {
      steps.saved(sent.steps);
      rebase(clientPoolOf(answer.body.pool));
    } else if (answer.status === 409 && answer.pool) {
      steps.clear();
      rollBack(answer.pool, sent.undoing ? { message: UNDO_DROPPED } : "conflict");
    } else if (answer.status === 404 || answer.status === 401) {
      dropQueue();
      rebase(saved.current);
      setGone(true);
    } else {
      const message = answer.status === 0 ? UNREACHABLE : answer.message;
      const lines = answer.lines ? { lines: answer.lines } : {};
      rollBack(saved.current, { message: `${message} Your last change wasn't saved.`, ...lines });
    }
    if (queue.current.length === 0) setSaving(false);
  }, [fetcher, rebase, rollBack, dropQueue, steps]);

  const change = useCallback(
    (ops: PoolOp[], { undo = false }: { undo?: boolean } = {}): boolean => {
      const before = view.current;
      const local = applyLocal(before, ops);
      if (!local.ok) {
        setFailure({ message: local.message, ...(local.lines ? { lines: local.lines } : {}) });
        return false;
      }
      setFailure(null);
      setConflict(false);
      steps.queued(before, ops, undo);
      queue.current.push(...ops);
      show(local.pool);
      setSaving(true);
      void exclusive(flush);
      return true;
    },
    [exclusive, flush, show, steps],
  );

  const undo = useCallback((): boolean => {
    const step = steps.pop();
    if (!step) return false;
    if (!applyLocal(view.current, step.ops).ok) {
      setFailure({ message: UNDO_STALE });
      return false;
    }
    return change(step.ops, { undo: true });
  }, [change, steps]);

  const reload = useCallback(
    async (own = false) => {
      const answer = await callPools<PoolBody>(fetcher, `/api/pools/${saved.current.id}`);
      if (answer.ok) {
        const next = clientPoolOf(answer.body.pool);
        // A pack sync changes no version: take its state alone.
        if (next.version === saved.current.version && !samePack(next.pack, saved.current.pack)) {
          rebase({ ...saved.current, pack: next.pack });
        }
        if (next.version <= saved.current.version) return;
        if (!sameContent(next, saved.current)) steps.clear();
        if (queue.current.length > 0 && !own) rollBack(next, "conflict");
        else rebase(next);
      } else if (answer.status === 404 || answer.status === 401) setGone(true);
    },
    [fetcher, rebase, rollBack, steps],
  );

  const poll = useCallback(() => void exclusive(() => reload()), [exclusive, reload]);
  usePoolPolling(poll, pollMs, gone);

  const adopt = useCallback(
    (next: ClientPool) => {
      const pool = clientPoolOf(next);
      if (!sameContent(pool, saved.current)) steps.clear();
      rebase(pool);
    },
    [rebase, steps],
  );
  const dismiss = useCallback(() => {
    setFailure(null);
    setConflict(false);
  }, []);

  return {
    pool,
    saving,
    failure,
    conflict,
    gone,
    change,
    undoSteps: steps.count,
    undo,
    exclusive,
    adopt,
    reload,
    dismiss,
  };
};
