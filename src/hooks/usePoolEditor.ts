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
 *       so once and stops asking.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

"use client";

import type { SlotLineError } from "@haruhimemoe/pool";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_OPS_PER_CALL } from "@/constants/built-pools";
import { callPools, type Fetcher, UNREACHABLE } from "@/lib/pool-client";
import type { PoolOp } from "@/schemas/built-pool-ops";
import { type ClientPack, type ClientPool, clientPoolOf } from "@/schemas/built-pool-view";
import { applyLocal } from "@/utils/built-editor";

export const POLL_MS = 15_000;

export const CONFLICT =
  "Someone else changed this pool. It's reloaded; your last change wasn't saved.";

export const GONE = "This pool was deleted or you no longer have access.";

export type EditorFailure = { message: string; lines?: SlotLineError[] };

export type PoolEditor = {
  /** The copy on screen: the saved pool with the queued changes on top. */
  pool: ClientPool;
  saving: boolean;
  failure: EditorFailure | null;
  conflict: boolean;
  gone: boolean;
  /** Applies a change and queues it; false (with `failure` set) when it can't apply. */
  change: (ops: PoolOp[]) => boolean;
  /** Runs a request in turn with the ops. */
  exclusive: <T>(task: () => Promise<T>) => Promise<T>;
  /** Takes a pool a request answered with as the saved copy. */
  adopt: (pool: ClientPool) => void;
  /**
   * Asks for the pool again. `own`: the new version is this editor's own change (one answered
   * without the pool), so queued changes go on top instead of counting as a conflict.
   */
  reload: (own?: boolean) => Promise<void>;
  dismiss: () => void;
};

type PoolBody = { pool: ClientPool };

const samePack = (a: ClientPack, b: ClientPack): boolean =>
  a.state === b.state && a.href === b.href && a.error === b.error && a.gone === b.gone;

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
  const lock = useRef<Promise<unknown>>(Promise.resolve());

  const show = useCallback((next: ClientPool) => {
    view.current = next;
    setPool(next);
  }, []);

  /** The saved pool with whatever is still queued on top (dropped if it no longer applies). */
  const rebase = useCallback(
    (next: ClientPool) => {
      saved.current = next;
      const local = applyLocal(next, queue.current);
      if (!local.ok) queue.current = [];
      show(local.ok ? local.pool : next);
    },
    [show],
  );

  const exclusive = useCallback(<T>(task: () => Promise<T>): Promise<T> => {
    const run = lock.current.then(task, task);
    lock.current = run.catch(() => undefined);
    return run;
  }, []);

  const rollBack = useCallback(
    (next: ClientPool, why: EditorFailure | "conflict") => {
      queue.current = [];
      rebase(next);
      if (why === "conflict") setConflict(true);
      else setFailure(why);
    },
    [rebase],
  );

  const flush = useCallback(async () => {
    const ops = queue.current.splice(0, MAX_OPS_PER_CALL);
    if (ops.length === 0) {
      setSaving(false);
      return;
    }
    const path = `/api/pools/${saved.current.id}/ops`;
    const body = { baseVersion: saved.current.version, ops };
    const answer = await callPools<PoolBody>(fetcher, path, { method: "POST", body });
    if (answer.ok) rebase(clientPoolOf(answer.body.pool));
    else if (answer.status === 409 && answer.pool) rollBack(answer.pool, "conflict");
    else if (answer.status === 404 || answer.status === 401) {
      queue.current = [];
      rebase(saved.current);
      setGone(true);
    } else {
      const message = answer.status === 0 ? UNREACHABLE : answer.message;
      const lines = answer.lines ? { lines: answer.lines } : {};
      rollBack(saved.current, { message: `${message} Your last change wasn't saved.`, ...lines });
    }
    if (queue.current.length === 0) setSaving(false);
  }, [fetcher, rebase, rollBack]);

  const change = useCallback(
    (ops: PoolOp[]): boolean => {
      const local = applyLocal(view.current, ops);
      if (!local.ok) {
        setFailure({ message: local.message, ...(local.lines ? { lines: local.lines } : {}) });
        return false;
      }
      setFailure(null);
      setConflict(false);
      queue.current.push(...ops);
      show(local.pool);
      setSaving(true);
      void exclusive(flush);
      return true;
    },
    [exclusive, flush, show],
  );

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
        if (queue.current.length > 0 && !own) rollBack(next, "conflict");
        else rebase(next);
      } else if (answer.status === 404 || answer.status === 401) setGone(true);
    },
    [fetcher, rebase, rollBack],
  );

  useEffect(() => {
    // A pool that's gone stays gone: no more asking.
    if (gone) return;
    const check = () => {
      if (document.visibilityState !== "hidden") void exclusive(() => reload());
    };
    const timer = window.setInterval(check, pollMs);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [exclusive, reload, pollMs, gone]);

  const adopt = useCallback((next: ClientPool) => rebase(clientPoolOf(next)), [rebase]);
  const dismiss = useCallback(() => {
    setFailure(null);
    setConflict(false);
  }, []);

  return { pool, saving, failure, conflict, gone, change, exclusive, adopt, reload, dismiss };
};
