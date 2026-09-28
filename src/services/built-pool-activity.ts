/**
 * @file src/services/built-pool-activity.ts
 * @desc Built pools' activity log: every change records who made it (osu! id and name), when,
 *       its kind and a summary, and the pool keeps its last 200 entries (older ones are trimmed
 *       on each write; the TTL index drops any after 180 days). A failed write is logged and
 *       never fails the change. Only the owner and editors read it (the last 20). Deleting a
 *       pool deletes its entries; deleting an account renames its entries on other pools to
 *       "deleted user" with no osu! id, and rewords entries that name it (an editor added or
 *       removed, a new owner) the same way.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { DELETED_USER, MAX_ACTIVITY_PER_POOL, RECENT_ACTIVITY } from "@/constants/activity";
import { QUERY_TIME_MS } from "@/constants/db";
import { builtPoolActivityCollection } from "@/models/BuiltPoolActivity";
import { type ClientActivity, storedActivitySchema } from "@/schemas/activity";
import { type Answer, loadFor } from "@/services/built-pools";
import { type ActivityNote, withoutSubject } from "@/utils/activity";
import type { Caller } from "@/utils/built-access";

/** Who made a change. */
export type Actor = { osuId: number; username: string };

/**
 * @function recordActivity
 * @param poolId {string} the pool that changed
 * @param actor {Actor} who changed it
 * @param note {ActivityNote} the kind and summary
 * @param now {Date} when (tests)
 * @returns {Promise<void>} once written and the pool's log trimmed to 200 (errors are logged)
 */
export const recordActivity = async (
  poolId: string,
  actor: Actor,
  note: ActivityNote,
  now: Date = new Date(),
): Promise<void> => {
  try {
    const log = await builtPoolActivityCollection();
    const { osuId, username } = actor;
    await log.insertOne({ poolId, at: now, osuId, username, ...note } as never);
    const cutoff = await log
      .find({ poolId }, { projection: { at: 1 } })
      .sort({ at: -1, _id: -1 })
      .skip(MAX_ACTIVITY_PER_POOL - 1)
      .limit(1)
      .next();
    if (cutoff) {
      await log.deleteMany({
        poolId,
        $or: [{ at: { $lt: cutoff.at } }, { at: cutoff.at, _id: { $lt: cutoff._id } }],
      });
    }
  } catch (error) {
    console.error(`[activity] ${poolId}`, error instanceof Error ? error.message : error);
  }
};

/**
 * @function recordFor
 * @param caller {Caller & { username?: string }} who made the change (a signed-in user)
 * @param poolId {string} the pool
 * @param note {ActivityNote} the kind and summary
 * @returns {Promise<void>} once recorded; nothing for a caller without an osu! name
 */
export const recordFor = async (
  caller: (Caller & { username?: string }) | null,
  poolId: string,
  note: ActivityNote,
): Promise<void> => {
  if (!caller || typeof caller.username !== "string") return;
  await recordActivity(poolId, { osuId: caller.osuId, username: caller.username }, note);
};

/**
 * @function listActivityFor
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} who's asking
 * @returns {Promise<Answer<ClientActivity[]>>} the last 20 entries, newest first, for the owner
 *          and editors; 404 or 403 for anyone else
 */
export const listActivityFor = async (
  id: string,
  caller: Caller,
): Promise<Answer<ClientActivity[]>> => {
  const loaded = await loadFor(id, caller, (access) => access.canEdit);
  if (!loaded.ok) return loaded;
  const rows = await (await builtPoolActivityCollection())
    .find({ poolId: id }, { maxTimeMS: QUERY_TIME_MS })
    .sort({ at: -1, _id: -1 })
    .limit(RECENT_ACTIVITY)
    .toArray();
  const entries = rows.flatMap((row) => {
    const parsed = storedActivitySchema.safeParse(row);
    if (!parsed.success) return [];
    const { _id, at, osuId, username, kind, summary } = parsed.data;
    return [{ id: String(_id), at: at.toISOString(), osuId, username, kind, summary }];
  });
  return { ok: true, value: entries };
};

/**
 * @function deleteActivityOf
 * @param poolIds {readonly string[]} pools that were deleted
 * @returns {Promise<void>} once their entries are gone
 */
export const deleteActivityOf = async (poolIds: readonly string[]): Promise<void> => {
  if (poolIds.length === 0) return;
  await (await builtPoolActivityCollection()).deleteMany({ poolId: { $in: [...poolIds] } });
};

/**
 * @function forgetActivityBy
 * @param osuId {number} a deleted account's osu! id
 * @returns {Promise<void>} once their entries say "deleted user", with no osu! id, and entries
 *          naming them (as an editor added or removed, or a new owner) say "deleted user" too
 */
export const forgetActivityBy = async (osuId: number): Promise<void> => {
  const log = await builtPoolActivityCollection();
  await log.updateMany({ osuId }, { $set: { osuId: null, username: DELETED_USER } });
  const about = await log
    .find({ "subject.osuId": osuId }, { projection: { kind: 1, summary: 1 } })
    .toArray();
  const writes = about.map(({ _id, kind, summary }) => ({
    updateOne: {
      filter: { _id },
      update: {
        $set: { summary: withoutSubject({ kind, summary }) },
        $unset: { subject: "" as const },
      },
    },
  }));
  if (writes.length > 0) await log.bulkWrite(writes);
};
