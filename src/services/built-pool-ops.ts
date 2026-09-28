/**
 * @file src/services/built-pool-ops.ts
 * @desc One ops call on a built pool, atomic: the owner or an editor sends the version they
 *       last saw and the ops. A different version is a 409 with the pool as it is now. The ops
 *       apply in memory, all or nothing (src/utils/built-ops.ts; a refusal is a 400 naming the
 *       op), and the whole new pool is written with one replace that only matches the version it
 *       was read at, so two editors can't both win: the loser gets the 409.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { PoolOp } from "@/schemas/built-pool-ops";
import {
  type Answer,
  type BuiltPoolView,
  findBuiltPool,
  loadFor,
  NOT_FOUND,
  refuse,
  toStored,
  viewOf,
} from "@/services/built-pools";
import { applyOps } from "@/utils/built-ops";

export const CONFLICT_MESSAGE = "Someone else changed this pool. Here it is as it is now.";

const conflict = async (id: string, caller: SessionUser): Promise<Answer<BuiltPoolView>> => {
  const current = await findBuiltPool(id);
  if (!current) return refuse(404, "not_found", NOT_FOUND);
  return refuse(409, "conflict", CONFLICT_MESSAGE, { pool: await viewOf(current, caller) });
};

/**
 * @function applyBuiltPoolOps
 * @param id {string} an untrusted built pool id
 * @param caller {SessionUser} the owner or an editor
 * @param baseVersion {number} the version the ops were made against
 * @param ops {readonly PoolOp[]} 1 to 20 parsed ops, in order
 * @param now {Date} current time (tests)
 * @returns {Promise<Answer<BuiltPoolView>>} the pool at its next version; 409 with the current
 *          pool for a stale version; 400 with the failing op's index and code
 */
export const applyBuiltPoolOps = async (
  id: string,
  caller: SessionUser,
  baseVersion: number,
  ops: readonly PoolOp[],
  now: Date = new Date(),
): Promise<Answer<BuiltPoolView>> => {
  const loaded = await loadFor(id, caller, (access) => access.canEdit);
  if (!loaded.ok) return loaded;
  const { pool } = loaded.value;
  if (pool.version !== baseVersion) return conflict(id, caller);
  const result = applyOps(pool, ops);
  if (!result.ok) {
    const { code, message, op, lines } = result;
    return refuse(400, code, message, { details: { op, ...(lines ? { lines } : {}) } });
  }
  let next: StoredBuiltPool;
  try {
    next = toStored({ ...pool, ...result.pool, version: baseVersion + 1, updatedAt: now });
  } catch (error) {
    const issue = error instanceof z.ZodError ? error.issues[0]?.message : undefined;
    return refuse(400, "invalid", issue ?? "That change isn't valid.");
  }
  const written = await (await builtPoolsCollection()).replaceOne(
    { _id: id, version: baseVersion },
    next,
  );
  if (written.matchedCount === 0) return conflict(id, caller);
  return { ok: true, value: await viewOf(next, caller) };
};
