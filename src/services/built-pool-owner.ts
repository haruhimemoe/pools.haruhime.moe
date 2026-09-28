/**
 * @file src/services/built-pool-owner.ts
 * @desc Handing a built pool to one of its editors. Only the owner can, typing the pool's name
 *       exactly; the editor must have signed in (so they have a user id to own it with) and own
 *       fewer than 50 pools. The editor becomes the owner, the old owner stays on as an editor,
 *       and the version goes up, in one write guarded by the version read (a change in between
 *       is a 409 with the pool as it is now). The cap is counted again after the write, which
 *       backs out when a create landed meanwhile. A shared pool's pack is marked pending, since
 *       its description credits the owner first.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
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
    const now = await findBuiltPool(id);
    if (!now) return refuse(404, "not_found", NOT_FOUND);
    const message = "Someone changed this pool meanwhile. Nothing was handed over.";
    return refuse(409, "conflict", message, { pool: await viewOf(now, caller) });
  }
  // A create may have landed since the count: take the pool back.
  if ((await owned()) > MAX_POOLS_PER_OWNER) {
    await swap(id, after.version, { ownerId: pool.ownerId, editors: pool.editors });
    return full();
  }
  return { ok: true, value: await viewOf((await markPackPending(id)) ?? after, caller) };
};
