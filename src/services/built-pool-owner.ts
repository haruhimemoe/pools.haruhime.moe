/**
 * @file src/services/built-pool-owner.ts
 * @desc Handing a built pool to one of its editors. Only the owner can, typing the pool's name
 *       exactly; the editor must have signed in (so they have a user id to own it with) and own
 *       fewer than 50 pools. The editor becomes the owner, the old owner stays on as an editor,
 *       and the version goes up, in one write guarded by the version read (a change in between
 *       is a 409 with the pool as it is now, or a 404 for an old owner who can't see it any
 *       more). The cap is counted again after the write, which gives the pool back when a create
 *       landed meanwhile: exactly as it was, or, when something changed in between, keeping the
 *       change and swapping only the two back; one that can't be given back (handed on or
 *       deleted) is reported as it stands. A shared pool's pack is marked pending, since its
 *       description credits the owner first.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { MAX_POOLS_PER_OWNER } from "@/constants/built-pools";
import type { SessionUser } from "@/lib/auth";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { BuiltEditor, StoredBuiltPool } from "@/schemas/built-pool";
import {
  type Answer,
  type BuiltPoolView,
  findBuiltPool,
  loadFor,
  markPackPending,
  NOT_FOUND,
  readBuiltPool,
  refuse,
  viewOf,
} from "@/services/built-pools";
import { accessOf } from "@/utils/built-access";

/** Who owns the pool and who edits it. */
type Hands = Pick<StoredBuiltPool, "ownerId" | "editors">;

/** Writes who owns and edits the pool, if it's still at `version`; the pool after, or null. */
const swap = async (id: string, version: number, hands: Hands) =>
  readBuiltPool(
    await (await builtPoolsCollection()).findOneAndUpdate(
      { _id: id, version },
      { $set: { ...hands, updatedAt: new Date() }, $inc: { version: 1 } },
      { returnDocument: "after" },
    ),
  );

/**
 * Gives the pool back to its old owner after a handover that went over the cap. Unchanged since
 * the handover, it gets its old owner and editors back; changed (an op, an editor added), it
 * keeps the change and only the two swap back, as long as the editor still owns it. The pool
 * after, or null when it can't be given back (deleted, or handed on).
 */
const giveBack = async (
  after: StoredBuiltPool,
  before: StoredBuiltPool,
  target: BuiltEditor & { userId: string },
  oldOwnerOsuId: number,
): Promise<StoredBuiltPool | null> => {
  const exact = await swap(after._id, after.version, {
    ownerId: before.ownerId,
    editors: before.editors,
  });
  if (exact) return exact;
  const withoutOldOwner = {
    $filter: { input: "$editors", cond: { $ne: ["$$this.osuId", oldOwnerOsuId] } },
  };
  return readBuiltPool(
    await (await builtPoolsCollection()).findOneAndUpdate(
      { _id: after._id, ownerId: target.userId },
      [
        {
          $set: {
            ownerId: before.ownerId,
            editors: { $concatArrays: [withoutOldOwner, [{ $literal: target }]] },
            updatedAt: new Date(),
            version: { $add: ["$version", 1] },
          },
        },
      ],
      { returnDocument: "after" },
    ),
  );
};

/** The pool as it is now, to a caller who can still see it; a 404 otherwise. */
const asItStands = async (
  id: string,
  caller: SessionUser,
): Promise<Answer<{ pool: StoredBuiltPool; view: BuiltPoolView }>> => {
  const now = await findBuiltPool(id);
  if (!now || !accessOf(now, caller).canView) return refuse(404, "not_found", NOT_FOUND);
  return { ok: true, value: { pool: now, view: await viewOf(now, caller) } };
};

/**
 * @function transferBuiltPool
 * @param id {string} an untrusted built pool id
 * @param caller {SessionUser} the owner
 * @param osuId {number} the editor to hand it to
 * @param confirmName {string} the pool's name as typed
 * @returns {Promise<Answer<BuiltPoolView>>} the pool as the old owner now sees it; 400 for a
 *          name that isn't the pool's, someone who doesn't edit it, an editor who hasn't signed
 *          in or one who owns 50 pools; 409 when the pool changed meanwhile
 */
export const transferBuiltPool = async (
  id: string,
  caller: SessionUser,
  osuId: number,
  confirmName: string,
): Promise<Answer<BuiltPoolView>> => {
  const loaded = await loadFor(id, caller, (access) => access.canManage);
  if (!loaded.ok) return loaded;
  const { pool } = loaded.value;
  if (confirmName !== pool.name) {
    return refuse(400, "wrong_name", "Type the pool's name exactly as it is to hand it over.");
  }
  const target = pool.editors.find((editor) => editor.osuId === osuId);
  if (!target) return refuse(400, "not_editor", "They don't edit this pool.");
  const { userId, username } = target;
  if (userId === null) {
    return refuse(400, "not_signed_in", `${username} hasn't signed in to pools yet.`);
  }
  const pools = await builtPoolsCollection();
  const owned = () => pools.countDocuments({ ownerId: userId });
  const full = () =>
    refuse(400, "too_many_pools", `${username} already owns ${MAX_POOLS_PER_OWNER} pools.`);
  if ((await owned()) >= MAX_POOLS_PER_OWNER) return full();
  const oldOwner: BuiltEditor = {
    userId: caller.id,
    osuId: caller.osuId,
    username: caller.username,
    addedAt: new Date(),
  };
  const editors = [...pool.editors.filter((editor) => editor.osuId !== osuId), oldOwner];
  const after = await swap(id, pool.version, { ownerId: userId, editors });
  if (!after) {
    // An editor removed since the first read gets a 404, never the pool.
    const now = await asItStands(id, caller);
    if (!now.ok) return now;
    const message = "Someone changed this pool meanwhile. Nothing was handed over.";
    return refuse(409, "conflict", message, { pool: now.value.view });
  }
  // A create may have landed since the count: take the pool back.
  if ((await owned()) > MAX_POOLS_PER_OWNER) {
    if (await giveBack(after, pool, { ...target, userId }, caller.osuId)) return full();
    // It can't be given back any more (handed on, or deleted): say how it stands.
    const now = await asItStands(id, caller);
    return now.ok ? { ok: true, value: now.value.view } : now;
  }
  return { ok: true, value: await viewOf((await markPackPending(id)) ?? after, caller) };
};
