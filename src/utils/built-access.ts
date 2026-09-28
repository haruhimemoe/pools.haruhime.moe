/**
 * @file src/utils/built-access.ts
 * @desc Who may do what to a built pool. The owner does everything; editors (matched by osu! id,
 *       so someone added before they ever signed in gets access once they do) see and change the
 *       maps and details; admins see any pool that isn't private and delete any pool
 *       (moderation), but never edit one; anyone else, signed in or not, sees an unlisted or
 *       public pool unless it's hidden. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { StoredBuiltPool } from "@/schemas/built-pool";

/** The signed-in caller (the parts access needs), or null for a visitor. */
export type Caller = { id: string; osuId: number; isAdmin: boolean } | null;

export type Access = {
  isOwner: boolean;
  isEditor: boolean;
  /** Read it (GET, and the pages later). */
  canView: boolean;
  /** Change its maps, buckets and details (ops). */
  canEdit: boolean;
  /** Change who sees it and who edits it. */
  canManage: boolean;
  canDelete: boolean;
};

/**
 * @function accessOf
 * @param pool {Pick<StoredBuiltPool, "ownerId" | "editors" | "visibility" | "hidden">} the pool
 * @param caller {Caller} who's asking
 * @returns {Access} what they may do
 */
export const accessOf = (
  pool: Pick<StoredBuiltPool, "ownerId" | "editors" | "visibility" | "hidden">,
  caller: Caller,
): Access => {
  const isOwner = caller !== null && caller.id === pool.ownerId;
  const isEditor =
    caller !== null && !isOwner && pool.editors.some((editor) => editor.osuId === caller.osuId);
  const isAdmin = caller?.isAdmin === true;
  const member = isOwner || isEditor;
  const shared = pool.visibility !== "private";
  return {
    isOwner,
    isEditor,
    canView: member || (shared && (!pool.hidden || isAdmin)),
    canEdit: member,
    canManage: isOwner,
    canDelete: isOwner || isAdmin,
  };
};
