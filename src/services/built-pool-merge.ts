/**
 * @file src/services/built-pool-merge.ts
 * @desc What an ops call's content becomes. When the client saw the pool's current content (its
 *       version, or the revision the row is at when only non-content fields moved), the ops
 *       apply to the live content. When it didn't, the ops apply to the revision it saw, and
 *       @haruhimemoe/vcs merges that with the live content (base: the revision). Candidates are
 *       outside history: they always come from the live row, changed by the call's own ops.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import type { RevisionRef } from "@haruhimemoe/vcs";
import { mergeValue } from "@haruhimemoe/vcs/json";
import { poolRevisions } from "@/lib/pool-revisions";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { PoolOp } from "@/schemas/built-pool-ops";
import { type Refusal, refuse } from "@/utils/built-answer";
import { applyOps, type OpResult } from "@/utils/built-ops";
import { type PlannedContent, tidyPlan } from "@/utils/built-plan-ops";
import type { Actor } from "@/utils/candidate-ops";
import { fromSnapshot, POOL_CODEC, snapshotOf } from "@/utils/pool-snapshot";

/** Where the client's ops start: the version it saw and, from newer clients, the revision. */
export type OpsBase = { baseVersion: number; base?: RevisionRef | undefined };

/** The content to save, a conflict (409 with the pool), or an op's refusal (400). */
export type Planned =
  | { ok: true; content: PlannedContent; merged: boolean }
  | { ok: false; conflict: true }
  | { ok: false; conflict: false; refusal: Refusal };

const CONFLICT = { ok: false, conflict: true } as const;

const planned = (result: OpResult, merged: boolean): Planned =>
  result.ok
    ? { ok: true, content: result.pool, merged }
    : {
        ok: false,
        conflict: false,
        refusal: refuse(400, result.code, result.message, {
          details: { op: result.op, ...(result.lines ? { lines: result.lines } : {}) },
        }),
      };

/**
 * @function planOps
 * @param pool {StoredBuiltPool} the pool as read
 * @param head {RevisionRef} the revision its content matches
 * @param from {OpsBase} what the client saw
 * @param ops {readonly PoolOp[]} the call's ops
 * @param actor {Actor} who and when
 * @returns {Promise<Planned>} the new content and whether it was merged, a conflict, or a refusal
 */
export const planOps = async (
  pool: StoredBuiltPool,
  head: RevisionRef,
  { baseVersion, base }: OpsBase,
  ops: readonly PoolOp[],
  actor: Actor,
): Promise<Planned> => {
  if (pool.version === baseVersion || base?.id === head.id) {
    return planned(applyOps(pool, ops, actor), false);
  }
  if (!base) return CONFLICT;
  const from = await poolRevisions.get(pool._id, base.id);
  if (!from || from.seq !== base.seq) return CONFLICT;
  const candidates = pool.candidates ? { candidates: pool.candidates } : {};
  const ours = applyOps({ ...fromSnapshot(from.value), ...candidates }, ops, actor);
  if (!ours.ok) return planned(ours, true);
  const merge = mergeValue(from.value, snapshotOf(ours.pool), snapshotOf(pool), POOL_CODEC);
  if (!merge.clean) return CONFLICT;
  const merged = tidyPlan({ ...fromSnapshot(merge.value), candidates: ours.pool.candidates });
  return { ok: true, content: merged, merged: true };
};
