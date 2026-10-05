/**
 * @file src/services/built-pool-history-read.ts
 * @desc Reading a built pool's history (src/utils/built-history-access.ts says who may) and
 *       turning historyPublic on or off. A first read of a pool from before history creates its
 *       root. loadPoolRevision diffs a revision against the one before it (none for the root)
 *       and, for anyone who isn't a member, runs both sides' slot notes through today's filter
 *       first, so a note a newer rule would refuse never shows in a change view (the pool page
 *       already hides those from non-members).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import "server-only";
import type { Change, RevisionMeta } from "@haruhimemoe/vcs";
import { diffValue } from "@haruhimemoe/vcs/json";
import { HISTORY_PRIVATE, REVISION_NOT_FOUND } from "@/constants/built-pools";
import { poolRevisions } from "@/lib/pool-revisions";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { passingNotes } from "@/schemas/built-plan";
import type { StoredBuiltPool } from "@/schemas/built-pool";
import { recordFor } from "@/services/built-pool-activity";
import { ensureHistory } from "@/services/built-pool-history";
import { findBuiltPool, readBuiltPool, viewOf } from "@/services/built-pool-read";
import { historyActivity } from "@/utils/activity";
import { accessOf, type Caller } from "@/utils/built-access";
import { type Answer, type BuiltPoolView, NOT_FOUND, refuse } from "@/utils/built-answer";
import { type HistoryAccess, historyAccessOf } from "@/utils/built-history-access";
import { POOL_CODEC, type PoolSnapshot } from "@/utils/pool-snapshot";

/** A page of a pool's history. */
export type PoolHistory = {
  pool: { id: string; name: string };
  access: HistoryAccess;
  historyPublic: boolean;
  revisions: RevisionMeta[];
  older: number | null;
};

/** One revision, diffed against the one before it. */
export type PoolRevisionView = {
  revision: RevisionMeta;
  previous: RevisionMeta | null;
  before: PoolSnapshot | null;
  after: PoolSnapshot;
  changes: Change[];
};

const HISTORY_PAGE = 50;

type Readable = { pool: StoredBuiltPool; access: HistoryAccess };

const readable = async (id: string, caller: Caller): Promise<Answer<Readable>> => {
  const pool = await findBuiltPool(id);
  if (!pool) return refuse(404, "not_found", NOT_FOUND);
  const access = historyAccessOf(pool, caller);
  if (!access.canRead) {
    return accessOf(pool, caller).canView
      ? refuse(403, "history_private", HISTORY_PRIVATE)
      : refuse(404, "not_found", NOT_FOUND);
  }
  await ensureHistory(pool);
  return { ok: true, value: { pool, access } };
};

/** Members see every note; anyone else only notes a write would take today. */
const shown = (snapshot: PoolSnapshot, isMember: boolean): PoolSnapshot =>
  isMember ? snapshot : { ...snapshot, slotNotes: passingNotes(snapshot.slotNotes) };

/**
 * @function loadPoolHistory
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} who's asking
 * @param before {number | undefined} only revisions with a lower seq (paging)
 * @returns {Promise<Answer<PoolHistory>>} the pool's name, the caller's access, whether its
 *          history is public, a page of revisions (newest first) and the next page's cursor;
 *          404 when the pool isn't there or the caller can't see it; 403 when they can see it but
 *          not its history
 */
export const loadPoolHistory = async (
  id: string,
  caller: Caller,
  before?: number,
): Promise<Answer<PoolHistory>> => {
  const loaded = await readable(id, caller);
  if (!loaded.ok) return loaded;
  const { pool, access } = loaded.value;
  const revisions = await poolRevisions.list(id, { before, limit: HISTORY_PAGE });
  const last = revisions.at(-1);
  const older = revisions.length === HISTORY_PAGE && last && last.seq > 0 ? last.seq : null;
  return {
    ok: true,
    value: {
      pool: { id: pool._id, name: pool.name },
      access,
      historyPublic: pool.historyPublic === true,
      revisions,
      older,
    },
  };
};

/**
 * @function loadPoolRevision
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} who's asking
 * @param revisionId {string} the revision to show
 * @returns {Promise<Answer<PoolRevisionView>>} the revision, the one before it (null for the
 *          root), both snapshots and the changes between them; 404 when the pool or the
 *          revision isn't there, or the caller can't see the pool; 403 when they can see it but
 *          not its history
 */
export const loadPoolRevision = async (
  id: string,
  caller: Caller,
  revisionId: string,
): Promise<Answer<PoolRevisionView>> => {
  const loaded = await readable(id, caller);
  if (!loaded.ok) return loaded;
  const revision = await poolRevisions.get(id, revisionId);
  if (!revision) return refuse(404, "revision_not_found", REVISION_NOT_FOUND);
  const [previousMeta] = await poolRevisions.list(id, { before: revision.seq, limit: 1 });
  const previous = previousMeta ? await poolRevisions.get(id, previousMeta.id) : null;
  const { isMember } = loaded.value.access;
  const after = shown(revision.value, isMember);
  const before = previous ? shown(previous.value, isMember) : null;
  const { value: _value, ...meta } = revision;
  return {
    ok: true,
    value: {
      revision: meta,
      previous: previousMeta ?? null,
      before,
      after,
      changes: before ? diffValue(before, after, POOL_CODEC) : [],
    },
  };
};

/**
 * @function setHistoryPublic
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} the owner
 * @param historyPublic {boolean} who may read the history from now on
 * @returns {Promise<Answer<BuiltPoolView>>} the pool after the change (unchanged if the value was
 *          already the same); 404 or 403 for anyone but the owner
 */
export const setHistoryPublic = async (
  id: string,
  caller: Caller,
  historyPublic: boolean,
): Promise<Answer<BuiltPoolView>> => {
  const pool = await findBuiltPool(id);
  if (!pool) return refuse(404, "not_found", NOT_FOUND);
  const access = historyAccessOf(pool, caller);
  if (!access.canToggle) {
    return accessOf(pool, caller).canView
      ? refuse(403, "forbidden", "You can't do that to this pool.")
      : refuse(404, "not_found", NOT_FOUND);
  }
  await ensureHistory(pool);
  if ((pool.historyPublic === true) === historyPublic) {
    return { ok: true, value: await viewOf(pool, caller) };
  }
  const updated = await (await builtPoolsCollection()).findOneAndUpdate(
    { _id: id },
    { $set: { historyPublic, updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: "after" },
  );
  const after = readBuiltPool(updated);
  if (!after) return refuse(404, "not_found", NOT_FOUND);
  await recordFor(caller, id, historyActivity(historyPublic));
  return { ok: true, value: await viewOf(after, caller) };
};
