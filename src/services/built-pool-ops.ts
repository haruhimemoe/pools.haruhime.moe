/**
 * @file src/services/built-pool-ops.ts
 * @desc One ops call on a built pool: the owner or an editor sends the version (and, from newer
 *       clients, the revision) they last saw and the ops. Seeing the pool's current content, the
 *       ops apply to it as today; a stale version whose revision the store still has is merged
 *       (src/services/built-pool-merge.ts) instead of reloaded. The ops apply in memory, all or
 *       nothing (src/utils/built-ops.ts; a refusal is a 400 naming the op), the whole new pool is
 *       checked against the stored schema (so a pool a newer content filter refuses has to be
 *       renamed in the same call), and its content (details, buckets, slots, targets, slot notes,
 *       candidates, version) is written with one $set that only matches the version it was read
 *       at, so two editors can't both win: the loser gets the 409 (src/services/built-pool-write.ts).
 *       Fields ops don't own (editors, pack, hidden) are never written here, so a change to them
 *       without a new version isn't undone. An unlisted or public pool's pack is marked pending
 *       (the route syncs it after the answer), and the change goes in the pool's activity log.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { PoolOp } from "@/schemas/built-pool-ops";
import type { SessionUser } from "@/schemas/session-user";
import { recordActivity } from "@/services/built-pool-activity";
import { authorOf, ensureHistory, recordRevision } from "@/services/built-pool-history";
import { type OpsBase, planOps } from "@/services/built-pool-merge";
import { loadFor, readBuiltPool, toStored, viewOf } from "@/services/built-pool-read";
import { conflict, contentOf, refusalOfZod } from "@/services/built-pool-write";
import { markPackPending } from "@/services/built-pools";
import { opsActivity } from "@/utils/activity";
import type { Answer, BuiltPoolView } from "@/utils/built-answer";
import type { BuiltSearchFields } from "@/utils/built-record";

/**
 * @function applyBuiltPoolOps
 * @param id {string} an untrusted built pool id
 * @param caller {SessionUser} the owner or an editor
 * @param from {OpsBase} the version (and, from newer clients, the revision) the ops were made
 *        against
 * @param ops {readonly PoolOp[]} 1 to 20 parsed ops, in order
 * @param now {Date} current time (tests)
 * @returns {Promise<Answer<{ pool: BuiltPoolView; merged: boolean }>>} the pool at its next
 *          version; 409 with the current pool for a stale version with no usable base, or a
 *          merge conflict; 400 with the failing op's index and code
 */
export const applyBuiltPoolOps = async (
  id: string,
  caller: SessionUser,
  from: OpsBase,
  ops: readonly PoolOp[],
  now: Date = new Date(),
): Promise<Answer<{ pool: BuiltPoolView; merged: boolean }>> => {
  const loaded = await loadFor(id, caller, (access) => access.canEdit);
  if (!loaded.ok) return loaded;
  const { pool } = loaded.value;
  const head = await ensureHistory(pool);
  const actor = { osuId: caller.osuId, now: now.toISOString() };
  const plan = await planOps(pool, head, from, ops, actor);
  if (!plan.ok) return plan.conflict ? conflict(id, caller) : plan.refusal;
  let next: StoredBuiltPool & BuiltSearchFields;
  try {
    // Content keys come only from the plan, so a merge that dropped buckets or notes drops them.
    const { buckets: _b, targets: _t, slotNotes: _n, candidates: _c, ...rest } = pool;
    next = toStored({ ...rest, ...plan.content, version: pool.version + 1, updatedAt: now });
  } catch (error) {
    // A merge the stored schema refuses (two maps in one slot) is a conflict, not a bad op.
    if (plan.merged) return conflict(id, caller);
    return refusalOfZod(error);
  }
  const written = await (await builtPoolsCollection()).findOneAndUpdate(
    { _id: id, version: pool.version },
    contentOf(next),
    { returnDocument: "after" },
  );
  const after = readBuiltPool(written);
  if (!after) return conflict(id, caller);
  await recordRevision(id, head, next, authorOf(caller));
  const note = opsActivity(pool, ops);
  // Votes alone aren't logged (too chatty).
  if (note) await recordActivity(id, caller, note, now);
  return {
    ok: true,
    value: {
      pool: await viewOf((await markPackPending(id)) ?? after, caller),
      merged: plan.merged,
    },
  };
};
