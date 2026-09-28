/**
 * @file src/services/built-pool-editors.ts
 * @desc A built pool's co-editors. The owner adds one by osu! username: osu! is asked (pools'
 *       own app, inside the osu! budget, the owner's share counted as "osu:<osuId>"), so someone
 *       who never signed in can be added; access follows their osu! id, and their user id is
 *       filled in when they first sign in (linkEditorAccount, from the auth hook). At most 10,
 *       never the owner, never twice. The owner removes any editor; an editor can remove
 *       themselves. Each change is a new version, and marks a shared pool's pack pending (its
 *       description names the editors).
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { MAX_EDITORS } from "@/constants/built-pools";
import type { SessionUser } from "@/lib/auth";
import { connectedDb } from "@/lib/db";
import { budgetGate } from "@/lib/osu-budget";
import { lookupOsuUser, type OsuUserLookup } from "@/lib/osu-users";
import { userSubject } from "@/lib/rate-limit";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { BuiltEditor } from "@/schemas/built-pool";
import {
  type Answer,
  type BuiltPoolView,
  loadFor,
  markPackPending,
  NOT_FOUND,
  readBuiltPool,
  refuse,
  viewOf,
} from "@/services/built-pools";

export type LookupUser = (
  username: string,
  options: { beforeCall: () => Promise<boolean> },
) => Promise<OsuUserLookup>;

/** The user id of whoever signed in with this osu! id, or null when nobody has yet. */
const userIdFor = async (osuId: number): Promise<string | null> => {
  const user = await (await connectedDb())
    .collection("user")
    .findOne({ osuId }, { projection: { _id: 1 } });
  return user ? String(user._id) : null;
};

const lookupRefusal = (lookup: OsuUserLookup, username: string) => {
  if (lookup.kind === "missing") {
    return refuse(400, "unknown_user", `osu! has nobody called ${username}.`);
  }
  return refuse(
    503,
    "osu_unavailable",
    "Couldn't ask osu! about that name. Try again in a minute.",
  );
};

/**
 * @function addBuiltPoolEditor
 * @param id {string} an untrusted built pool id
 * @param caller {SessionUser} the owner
 * @param username {string} the osu! username as typed
 * @param lookup {LookupUser} the osu! lookup (tests)
 * @returns {Promise<Answer<BuiltPoolView>>} the pool with the new editor; 400 for a name osu!
 *          doesn't know, the owner, someone already editing or an 11th editor; 503 when osu!
 *          can't be asked
 */
export const addBuiltPoolEditor = async (
  id: string,
  caller: SessionUser,
  username: string,
  lookup: LookupUser = lookupOsuUser,
): Promise<Answer<BuiltPoolView>> => {
  const loaded = await loadFor(id, caller, (access) => access.canManage);
  if (!loaded.ok) return loaded;
  const { pool } = loaded.value;
  const full = () =>
    refuse(400, "too_many_editors", `A pool can have at most ${MAX_EDITORS} editors.`);
  if (pool.editors.length >= MAX_EDITORS) return full();
  const beforeCall = budgetGate(await connectedDb(), userSubject(caller));
  const found = await lookup(username, { beforeCall });
  if (found.kind !== "found") return lookupRefusal(found, username);
  if (found.osuId === caller.osuId) {
    return refuse(400, "is_owner", "That's you: you own this pool.");
  }
  const taken = () => refuse(400, "already_editor", `${found.username} already edits this pool.`);
  if (pool.editors.some((editor) => editor.osuId === found.osuId)) return taken();
  const editor: BuiltEditor = {
    userId: await userIdFor(found.osuId),
    osuId: found.osuId,
    username: found.username,
    addedAt: new Date(),
  };
  const updated = await (await builtPoolsCollection()).findOneAndUpdate(
    {
      _id: id,
      "editors.osuId": { $ne: found.osuId },
      [`editors.${MAX_EDITORS - 1}`]: { $exists: false },
    },
    { $push: { editors: editor }, $set: { updatedAt: editor.addedAt }, $inc: { version: 1 } },
    { returnDocument: "after" },
  );
  // Someone else added them (or filled the list) since the read.
  const after = readBuiltPool(updated);
  if (!after) return taken();
  return { ok: true, value: await viewOf((await markPackPending(id)) ?? after, caller) };
};

/**
 * @function removeBuiltPoolEditor
 * @param id {string} an untrusted built pool id
 * @param caller {SessionUser} the owner, or the editor themselves
 * @param osuId {number} the editor's osu! id
 * @returns {Promise<Answer<null>>} ok once they no longer edit it; 404 when they didn't
 */
export const removeBuiltPoolEditor = async (
  id: string,
  caller: SessionUser,
  osuId: number,
): Promise<Answer<null>> => {
  const self = caller.osuId === osuId;
  const loaded = await loadFor(id, caller, (a) => a.canManage || (self && a.isEditor));
  if (!loaded.ok) return loaded;
  if (!loaded.value.pool.editors.some((editor) => editor.osuId === osuId)) {
    return refuse(404, "not_editor", "They don't edit this pool.");
  }
  const updated = await (await builtPoolsCollection()).updateOne(
    { _id: id, "editors.osuId": osuId },
    { $pull: { editors: { osuId } }, $set: { updatedAt: new Date() }, $inc: { version: 1 } },
  );
  if (updated.matchedCount === 0) return refuse(404, "not_found", NOT_FOUND);
  await markPackPending(id);
  return { ok: true, value: null };
};

/**
 * @function linkEditorAccount
 * @param osuId {number} the osu! id someone just signed in with for the first time
 * @param userId {string} their new user id
 * @returns {Promise<void>} fills in their user id on every pool that lists them as an editor
 */
export const linkEditorAccount = async (osuId: number, userId: string): Promise<void> => {
  await (await builtPoolsCollection()).updateMany(
    { "editors.osuId": osuId },
    { $set: { "editors.$[editor].userId": userId } },
    { arrayFilters: [{ "editor.osuId": osuId }] },
  );
};
