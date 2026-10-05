/**
 * @file src/services/built-pool-history.ts
 * @desc A built pool's history plumbing. A pool gets its root revision lazily (its content as
 *       it was, on the first save, history read or toggle after history shipped), and `head` on
 *       the row names the revision its content matches. The live row stays the authority: a
 *       save writes the row under its version guard first, then appends its content here (best
 *       effort, logged). A commit that comes back conflict or missing lost a race to a later
 *       save, which read this save's row and so carries its content.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import type { RevisionAuthor } from "@haruhimemoe/next-kit/vcs";
import type { Revision, RevisionRef } from "@haruhimemoe/vcs";
import { poolRevisions } from "@/lib/pool-revisions";
import { builtPoolsCollection } from "@/models/BuiltPool";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import type { SessionUser } from "@/schemas/session-user";
import type { BuiltContent } from "@/utils/built-content";
import { type PoolSnapshot, snapshotOf } from "@/utils/pool-snapshot";

/** The author of a root made for a pool that existed before history. */
export const SYSTEM_AUTHOR: RevisionAuthor = { id: "pools", name: "pools" };
/** That root's message. */
export const HISTORY_START = "Saved before history was kept.";

/**
 * @function authorOf
 * @param user {Pick<SessionUser, "id" | "username">} the signed-in caller
 * @returns {RevisionAuthor} their user id and osu! name
 */
export const authorOf = (user: Pick<SessionUser, "id" | "username">): RevisionAuthor => ({
  id: user.id,
  name: user.username,
});

/**
 * @function refOf
 * @param revision {RevisionRef} a revision (or its ref)
 * @returns {RevisionRef} just its id and seq
 */
export const refOf = ({ id, seq }: RevisionRef): RevisionRef => ({ id, seq });

/**
 * @function setHead
 * @param id {string} the pool
 * @param ref {RevisionRef} a revision just written
 * @returns {Promise<void>} once the row names it, unless the row already names a later one
 */
export const setHead = async (id: string, ref: RevisionRef): Promise<void> => {
  await (await builtPoolsCollection()).updateOne(
    { _id: id, $or: [{ head: { $exists: false } }, { "head.seq": { $lt: ref.seq } }] },
    { $set: { head: ref } },
  );
};

const startHistory = async (
  pool: StoredBuiltPool,
  author: RevisionAuthor,
  message: string | null,
): Promise<Revision<PoolSnapshot>> => {
  try {
    return await poolRevisions.create(pool._id, snapshotOf(pool), author, message);
  } catch (error) {
    // Two first saves at once: the other one made the root.
    const head = await poolRevisions.head(pool._id);
    if (head) return head;
    throw error;
  }
};

/**
 * @function ensureHistory
 * @param pool {StoredBuiltPool} the pool as read
 * @param author {RevisionAuthor} who a new root is by (default SYSTEM_AUTHOR)
 * @param message {string | null} a new root's message (default HISTORY_START)
 * @returns {Promise<RevisionRef>} the revision the row's content matches, made now if the pool
 *          had none
 */
export const ensureHistory = async (
  pool: StoredBuiltPool,
  author: RevisionAuthor = SYSTEM_AUTHOR,
  message: string | null = HISTORY_START,
): Promise<RevisionRef> => {
  if (pool.head) return pool.head;
  const head = (await poolRevisions.head(pool._id)) ?? (await startHistory(pool, author, message));
  await setHead(pool._id, refOf(head));
  return refOf(head);
};

/**
 * @function recordRevision
 * @param id {string} the pool
 * @param head {RevisionRef} the revision the row matched when the save read it
 * @param next {BuiltContent} the content the save just wrote
 * @param author {RevisionAuthor} who saved
 * @returns {Promise<RevisionRef>} the row's revision after this save (the old head when nothing
 *          was written or the write failed, which is logged, never thrown)
 */
export const recordRevision = async (
  id: string,
  head: RevisionRef,
  next: BuiltContent,
  author: RevisionAuthor,
): Promise<RevisionRef> => {
  try {
    const result = await poolRevisions.commit({
      docId: id,
      base: head,
      value: snapshotOf(next),
      author,
    });
    if (result.status === "committed" || result.status === "merged") {
      await setHead(id, refOf(result.revision));
      return refOf(result.revision);
    }
    if (result.status === "unchanged") return refOf(result.revision);
    console.warn(`[history] ${id}: ${result.status}; a later save holds this content`);
  } catch (error) {
    console.error(`[history] ${id} not recorded`, error);
  }
  return head;
};
