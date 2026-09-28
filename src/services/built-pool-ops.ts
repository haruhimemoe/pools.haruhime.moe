/**
 * @file src/services/built-pool-ops.ts
 * @desc One ops call on a built pool, atomic: the owner or an editor sends the version they
 *       last saw and the ops. A different version is a 409 with the pool as it is now. The ops
 *       apply in memory, all or nothing (src/utils/built-ops.ts; a refusal is a 400 naming the
 *       op), the whole new pool is checked against the stored schema (so a pool a newer content
 *       filter refuses has to be renamed in the same call), and its content (details, buckets,
 *       slots, targets, slot notes, version) is written with one $set that only matches the version it was
 *       read at, so two editors can't both win: the loser gets the 409. Fields ops don't own (editors,
 *       pack, hidden) are never written here, so a change to them without a new version isn't
 *       undone. An unlisted or public pool's pack is marked pending (the route syncs it after
 *       the answer), and the change goes in the pool's activity log. The 409's pool goes only
 *       to someone who can still see it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { PoolOp } from "@/schemas/built-pool-ops";
import { recordActivity } from "@/services/built-pool-activity";
import {
  type Answer,
  type BuiltPoolView,
  findBuiltPool,
  loadFor,
  markPackPending,
  NOT_FOUND,
  readBuiltPool,
  refuse,
  toStored,
  viewOf,
} from "@/services/built-pools";
import { opsActivity } from "@/utils/activity";
import { accessOf } from "@/utils/built-access";
import { applyOps } from "@/utils/built-ops";
import type { BuiltSearchFields } from "@/utils/built-record";

export const CONFLICT_MESSAGE = "Someone else changed this pool. Here it is as it is now.";

const conflict = async (id: string, caller: SessionUser): Promise<Answer<BuiltPoolView>> => {
  const current = await findBuiltPool(id);
  // An editor removed since the first read gets a 404, never the pool.
  if (!current || !accessOf(current, caller).canView) return refuse(404, "not_found", NOT_FOUND);
  return refuse(409, "conflict", CONFLICT_MESSAGE, { pool: await viewOf(current, caller) });
};

/** What an ops write sets: the content, its search fields, the version and when. */
const contentOf = ({
  buckets,
  targets,
  slotNotes,
  ...pool
}: StoredBuiltPool & BuiltSearchFields) => {
  // toStored leaves out the default buckets, no targets and no notes: the stored ones go too.
  const gone: Record<string, ""> = {};
  for (const [key, value] of Object.entries({ buckets, targets, slotNotes })) {
    if (value === undefined) gone[key] = "";
  }
  return {
    $set: {
      searchText: pool.searchText,
      sortName: pool.sortName,
      mapCount: pool.mapCount,
      name: pool.name,
      tournament: pool.tournament,
      round: pool.round,
      year: pool.year,
      notes: pool.notes,
      slots: pool.slots,
      version: pool.version,
      updatedAt: pool.updatedAt,
      ...(buckets === undefined ? {} : { buckets }),
      ...(targets === undefined ? {} : { targets }),
      ...(slotNotes === undefined ? {} : { slotNotes }),
    },
    ...(Object.keys(gone).length > 0 ? { $unset: gone } : {}),
  };
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
  let next: StoredBuiltPool & BuiltSearchFields;
  try {
    next = toStored({ ...pool, ...result.pool, version: baseVersion + 1, updatedAt: now });
  } catch (error) {
    const issue = error instanceof z.ZodError ? error.issues[0] : undefined;
    const named = issue?.code === "custom" ? issue.params?.code : undefined;
    return refuse(
      400,
      typeof named === "string" ? named : "invalid",
      issue?.message ?? "That change isn't valid.",
    );
  }
  const written = await (await builtPoolsCollection()).findOneAndUpdate(
    { _id: id, version: baseVersion },
    contentOf(next),
    { returnDocument: "after" },
  );
  const after = readBuiltPool(written);
  if (!after) return conflict(id, caller);
  await recordActivity(id, caller, opsActivity(pool, ops), now);
  return { ok: true, value: await viewOf((await markPackPending(id)) ?? after, caller) };
};
