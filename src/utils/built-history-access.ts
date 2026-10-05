/**
 * @file src/utils/built-history-access.ts
 * @desc Who may read, revert and open up a built pool's history. Owner and editors always read
 *       it and editors revert (they could make the same change by hand); only the owner turns
 *       historyPublic on or off. With it on, anyone who can see the pool reads its history,
 *       except while the pool is private or hidden: those hide history from everyone but its
 *       members and admins. Admins read the history of any pool that isn't private (for
 *       moderation) but never revert or toggle. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { StoredBuiltPool } from "@/schemas/built-pool";
import { accessOf, type Caller } from "@/utils/built-access";

/** What a caller may do with a pool's history. */
export type HistoryAccess = {
  canRead: boolean;
  canRevert: boolean;
  canToggle: boolean;
  isMember: boolean;
};

/** The parts of a pool history access reads. */
export type HistoryGuarded = Pick<
  StoredBuiltPool,
  "ownerId" | "editors" | "visibility" | "hidden" | "historyPublic"
>;

/**
 * @function historyAccessOf
 * @param pool {HistoryGuarded} the pool
 * @param caller {Caller} who's asking
 * @returns {HistoryAccess} what they may do with its history
 */
export const historyAccessOf = (pool: HistoryGuarded, caller: Caller): HistoryAccess => {
  const access = accessOf(pool, caller);
  const isMember = access.isOwner || access.isEditor;
  const open = pool.historyPublic === true && pool.visibility !== "private" && !pool.hidden;
  const moderator = caller?.isAdmin === true && pool.visibility !== "private";
  return {
    canRead: isMember || moderator || (open && access.canView),
    canRevert: access.canEdit,
    canToggle: access.canManage,
    isMember,
  };
};
