/**
 * @file src/services/built-pool-revert.ts
 * @desc Restoring a built pool to an earlier revision: the owner or an editor only; the target
 *       must be a revision of this pool; the restored content keeps today's candidates (tidied
 *       against the restored slots); the whole pool goes through toStored, so a revision whose
 *       name or notes today's content filter refuses is a 400 and nothing changes (revert is no
 *       filter bypass); the row is written under its version guard (409 with the pool on a
 *       race); then the store's own revert appends kind "revert" (base: the target). Reverting
 *       to the content the row already holds is a no-op. The pack is marked pending and the
 *       change goes in the activity log, like an ops call.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import { hashValue } from "@haruhimemoe/vcs/hash";
import { REVISION_NOT_FOUND } from "@/constants/built-pools";
import { poolRevisions } from "@/lib/pool-revisions";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { SessionUser } from "@/schemas/session-user";
import { recordFor } from "@/services/built-pool-activity";
import { authorOf, ensureHistory, refOf, setHead } from "@/services/built-pool-history";
import { loadFor, readBuiltPool, toStored, viewOf } from "@/services/built-pool-read";
import { conflict, contentOf, refusalOfZod } from "@/services/built-pool-write";
import { markPackPending } from "@/services/built-pools";
import { revertActivity } from "@/utils/activity";
import { type Answer, type BuiltPoolView, refuse } from "@/utils/built-answer";
import { tidyPlan } from "@/utils/built-plan-ops";
import type { BuiltSearchFields } from "@/utils/built-record";
import { fromSnapshot, snapshotOf } from "@/utils/pool-snapshot";

/**
 * @function revertBuiltPool
 * @param id {string} an untrusted built pool id
 * @param caller {SessionUser} the owner or an editor
 * @param revisionId {string} the revision to restore
 * @param now {Date} current time (tests)
 * @returns {Promise<Answer<BuiltPoolView>>} the pool at its next version; 404 for an unknown
 *          revision; 400 when today's rules refuse the old content; 409 on a lost race
 */
export const revertBuiltPool = async (
  id: string,
  caller: SessionUser,
  revisionId: string,
  now: Date = new Date(),
): Promise<Answer<BuiltPoolView>> => {
  const loaded = await loadFor(id, caller, (access) => access.canEdit);
  if (!loaded.ok) return loaded;
  const { pool } = loaded.value;
  await ensureHistory(pool);
  const target = await poolRevisions.get(id, revisionId);
  if (!target) return refuse(404, "revision_not_found", REVISION_NOT_FOUND);
  const candidates = pool.candidates ? { candidates: pool.candidates } : {};
  const content = tidyPlan({ ...fromSnapshot(target.value), ...candidates });
  const { buckets: _b, targets: _t, slotNotes: _n, candidates: _c, ...rest } = pool;
  let next: StoredBuiltPool & BuiltSearchFields;
  try {
    next = toStored({ ...rest, ...content, version: pool.version + 1, updatedAt: now });
  } catch (error) {
    return refusalOfZod(error);
  }
  // Reverting to what the pool already holds (its content, not candidates) changes nothing.
  if ((await hashValue(snapshotOf(pool))) === (await hashValue(snapshotOf(next)))) {
    return { ok: true, value: await viewOf(pool, caller) };
  }
  const written = await (await builtPoolsCollection()).findOneAndUpdate(
    { _id: id, version: pool.version },
    contentOf(next),
    { returnDocument: "after" },
  );
  const after = readBuiltPool(written);
  if (!after) return conflict(id, caller);
  const result = await poolRevisions
    .revert(id, revisionId, authorOf(caller))
    .catch((error: unknown) => {
      console.error(`[history] ${id} revert not recorded`, error);
      return null;
    });
  if (result?.status === "committed") await setHead(id, refOf(result.revision));
  await recordFor(caller, id, revertActivity(target.createdAt));
  const synced = (await markPackPending(id)) ?? after;
  return { ok: true, value: await viewOf(synced, caller) };
};
