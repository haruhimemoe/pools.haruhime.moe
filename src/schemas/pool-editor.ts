/**
 * @file src/schemas/pool-editor.ts
 * @desc What the pool editor hook gives its components (src/hooks/usePoolEditor.ts): the copy on
 *       screen, its saving state and failures, and the change, undo, exclusive, adopt and reload
 *       calls. Types only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import type { SlotLineError } from "@haruhimemoe/pool";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { ClientPool } from "@/schemas/built-pool-view";

/** Why a change didn't stand, with a paste's bad lines. */
export type EditorFailure = { message: string; lines?: SlotLineError[] };

/** What usePoolEditor gives the editor's components. */
export type PoolEditor = {
  /** The copy on screen: the saved pool with the queued changes on top. */
  pool: ClientPool;
  saving: boolean;
  failure: EditorFailure | null;
  conflict: boolean;
  gone: boolean;
  /** Applies a change and queues it; false (with `failure` set) when it can't apply. */
  change: (ops: PoolOp[]) => boolean;
  /** How many of this session's own changes can be undone (at most 20). */
  undoSteps: number;
  /** Sends the inverse of this session's last change; false when there's none or it can't. */
  undo: () => boolean;
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
