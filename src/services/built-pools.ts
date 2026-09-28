/**
 * @file src/services/built-pools.ts
 * @desc Database work for pools built here: reading one (by shape only, builtPoolReadSchema, so
 *       a pool a newer content filter or limit would refuse still reads and can be fixed or
 *       deleted; a row of the wrong shape is left out, never shown half-broken), what a caller
 *       sees of it (the owner's current osu! name, every bucket, and for the owner which editors
 *       have signed in, its targets and slot notes), creating one (at most 50 per owner, a fresh "b-" id claimed in
 *       built_pool_ids so no id is ever reused, maybe copied from a past pool or a built one the
 *       caller can see), changing who sees it, and deleting it. A pool with a pack on packs
 *       loses the pack (going private, being deleted); when packs can't be asked, the change
 *       goes ahead and the removal is queued (src/services/pack-cleanup.ts), and the answer
 *       says so. Lists a user's pools for their account page. Answers are a value or a
 *       refusal with a status, code and message.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { type BucketEntry, bucketsOf, type PoolSlot } from "@haruhimemoe/pool";
import { type Filter, ObjectId } from "mongodb";
import {
  BUILT_POOL_ID_PATTERN,
  MAX_POOLS_PER_OWNER,
  type Visibility,
} from "@/constants/built-pools";
import { QUERY_TIME_MS } from "@/constants/db";
import type { SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { builtPoolsCollection } from "@/models/BuiltPool";
import { type BucketTargets, passingNotes, type SlotNotes } from "@/schemas/built-plan";
import {
  type BuiltEditor,
  builtPoolReadSchema,
  type StoredBuiltPool,
  storedBuiltPoolSchema,
} from "@/schemas/built-pool";
import type { ClientPack } from "@/schemas/built-pool-view";
import { deleteActivityOf, recordFor } from "@/services/built-pool-activity";
import { type PackRemoval, removePackOrQueue } from "@/services/pack-cleanup";
import { visibilityActivity } from "@/utils/activity";
import { type Access, accessOf, type Caller } from "@/utils/built-access";
import { clientPackOf, EMPTY_BUILT_PACK } from "@/utils/built-pack";
import { type BuiltSearchFields, builtSearchFields } from "@/utils/built-record";

export type Refusal = {
  ok: false;
  status: 400 | 403 | 404 | 409 | 502 | 503;
  code: string;
  message: string;
  /** Extra fields for the error body (the failing op, a paste's lines). */
  details?: Record<string, unknown>;
  /** The pool as it is now (a 409). */
  pool?: BuiltPoolView;
};

export type Answer<T> = { ok: true; value: T } | Refusal;

/**
 * @function refuse
 * @param status {Refusal["status"]} HTTP status
 * @param code {string} machine code
 * @param message {string} for people
 * @param extra {Pick<Refusal, "details" | "pool">} more to send
 * @returns {Refusal} the refusal
 */
export const refuse = (
  status: Refusal["status"],
  code: string,
  message: string,
  extra: Pick<Refusal, "details" | "pool"> = {},
): Refusal => ({ ok: false, status, code, message, ...extra });

export const NOT_FOUND = "That pool isn't here.";

/** What the API sends: the pool, its owner's osu! name, every bucket, and the caller's rights. */
export type BuiltPoolView = {
  id: string;
  name: string;
  tournament: string;
  round: string;
  year: number | null;
  notes: string;
  visibility: Visibility;
  hidden: boolean;
  owner: { osuId: number; username: string } | null;
  /** signedIn (they have a user id) goes to the owner only, who can hand the pool to them. */
  editors: (Omit<BuiltEditor, "userId"> & { signedIn?: boolean })[];
  buckets: BucketEntry[];
  slots: PoolSlot[];
  /** Each bucket's target ({} when there are none). */
  targets: BucketTargets;
  /** Each slot's note by beatmap id ({} when there are none). */
  slotNotes: SlotNotes;
  version: number;
  pack: ClientPack;
  startedFrom: string | null;
  createdAt: Date;
  updatedAt: Date;
  access: Pick<Access, "isOwner" | "isEditor" | "canEdit" | "canManage" | "canDelete">;
};

/**
 * @function readBuiltPool
 * @param row {unknown} a built_pools row
 * @returns {StoredBuiltPool | null} the pool by shape (builtPoolReadSchema), or null for a row
 *          of the wrong shape (logged)
 */
export const readBuiltPool = (row: unknown): StoredBuiltPool | null => {
  if (!row) return null;
  const parsed = builtPoolReadSchema.safeParse(row);
  if (parsed.success) return parsed.data;
  const id = typeof row === "object" && "_id" in row ? String(row._id) : "a row";
  console.error(`[built] ${id} doesn't parse`, parsed.error.issues[0]?.message);
  return null;
};

/**
 * @function findBuiltPool
 * @param id {string} an untrusted built pool id
 * @returns {Promise<StoredBuiltPool | null>} the pool, or null (no such id, or a row of the
 *          wrong shape, which is logged)
 */
export const findBuiltPool = async (id: string): Promise<StoredBuiltPool | null> => {
  if (!BUILT_POOL_ID_PATTERN.test(id)) return null;
  return readBuiltPool(await (await builtPoolsCollection()).findOne({ _id: id }));
};

/**
 * @function toStored
 * @param pool {StoredBuiltPool} a pool about to be written
 * @returns {StoredBuiltPool & BuiltSearchFields} the same pool, checked, with `buckets` left out
 *          for the default list and `targets` and `slotNotes` when there are none (the driver would store an
 *          undefined value as null), and its search fields
 * @throws {z.ZodError} when it doesn't satisfy the stored schema (a bug)
 */
export const toStored = (pool: StoredBuiltPool): StoredBuiltPool & BuiltSearchFields => {
  const { buckets, targets, slotNotes, ...rest } = storedBuiltPoolSchema.parse(pool);
  const some = (record: object | undefined) =>
    record !== undefined && Object.keys(record).length > 0;
  const stored = {
    ...rest,
    ...(buckets === undefined ? {} : { buckets }),
    ...(some(targets) ? { targets } : {}),
    ...(some(slotNotes) ? { slotNotes } : {}),
  };
  return { ...stored, ...builtSearchFields(stored) };
};

/**
 * @function ownerOf
 * @param ownerId {string} a pool's owner (a user id)
 * @returns {Promise<BuiltPoolView["owner"]>} their osu! id and current username, or null when
 *          the user row is gone
 */
export const ownerOf = async (ownerId: string): Promise<BuiltPoolView["owner"]> => {
  if (!ObjectId.isValid(ownerId)) return null;
  const user = await getDb()
    .collection("user")
    .findOne({ _id: new ObjectId(ownerId) }, { projection: { osuId: 1, username: 1 } });
  return typeof user?.osuId === "number" && typeof user.username === "string"
    ? { osuId: user.osuId, username: user.username }
    : null;
};

/**
 * @function ownerNamesOf
 * @param ownerIds {readonly string[]} pools' owners (user ids)
 * @returns {Promise<Map<string, string>>} each one's current osu! username, where the user row is
 *          there (one query)
 */
export const ownerNamesOf = async (ownerIds: readonly string[]): Promise<Map<string, string>> => {
  const ids = [...new Set(ownerIds)].filter((id) => ObjectId.isValid(id));
  if (ids.length === 0) return new Map();
  const users = await getDb()
    .collection("user")
    .find(
      { _id: { $in: ids.map((id) => new ObjectId(id)) } },
      { projection: { username: 1 }, maxTimeMS: QUERY_TIME_MS },
    )
    .toArray();
  return new Map(
    users.flatMap((user) =>
      typeof user.username === "string" ? [[String(user._id), user.username] as const] : [],
    ),
  );
};

/**
 * @function viewOf
 * @param pool {StoredBuiltPool} a stored pool the caller may see
 * @param caller {Caller} who's asking
 * @returns {Promise<BuiltPoolView>} what the API sends
 */
export const viewOf = async (pool: StoredBuiltPool, caller: Caller): Promise<BuiltPoolView> => {
  const { isOwner, isEditor, canEdit, canManage, canDelete } = accessOf(pool, caller);
  return {
    id: pool._id,
    name: pool.name,
    tournament: pool.tournament,
    round: pool.round,
    year: pool.year,
    notes: pool.notes,
    visibility: pool.visibility,
    hidden: pool.hidden,
    owner: await ownerOf(pool.ownerId),
    editors: pool.editors.map(({ userId, osuId, username, addedAt }) => ({
      osuId,
      username,
      addedAt,
      ...(canManage ? { signedIn: userId !== null } : {}),
    })),
    buckets: bucketsOf(pool).map((entry) => ({ ...entry })),
    slots: pool.slots,
    targets: pool.targets ?? {},
    // Everyone else sees only notes a write would take today; editors see theirs to fix them.
    slotNotes: canEdit ? (pool.slotNotes ?? {}) : passingNotes(pool.slotNotes ?? {}),
    version: pool.version,
    // packs' reasons are for the people who fix the pool.
    pack: clientPackOf(pool, { withError: canEdit }),
    startedFrom: pool.startedFrom,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    access: { isOwner, isEditor, canEdit, canManage, canDelete },
  };
};

/**
 * @function getBuiltPoolFor
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} who's asking
 * @returns {Promise<Answer<BuiltPoolView>>} the pool, or 404 when it's not there or not theirs
 *          to see
 */
export const getBuiltPoolFor = async (
  id: string,
  caller: Caller,
): Promise<Answer<BuiltPoolView>> => {
  const pool = await findBuiltPool(id);
  if (!pool || !accessOf(pool, caller).canView) return refuse(404, "not_found", NOT_FOUND);
  return { ok: true, value: await viewOf(pool, caller) };
};

/**
 * @function loadFor
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} who's asking
 * @param may {(access: Access) => boolean} what they need to be allowed
 * @returns {Promise<Answer<{ pool: StoredBuiltPool; access: Access }>>} the pool and the
 *          caller's access; 404 when it's not there or they can't see it (and aren't allowed
 *          anyway), 403 when they see it but aren't allowed
 */
export const loadFor = async (
  id: string,
  caller: Caller,
  may: (access: Access) => boolean,
): Promise<Answer<{ pool: StoredBuiltPool; access: Access }>> => {
  const pool = await findBuiltPool(id);
  if (!pool) return refuse(404, "not_found", NOT_FOUND);
  const access = accessOf(pool, caller);
  const allowed = may(access);
  if (!access.canView && !allowed) return refuse(404, "not_found", NOT_FOUND);
  if (!allowed) return refuse(403, "forbidden", "You can't do that to this pool.");
  return { ok: true, value: { pool, access } };
};

/**
 * Pools a change sends to packs: unlisted or public, not removed by packs' moderators, and with
 * maps or a pack to take down (any state but none: a first PUT that failed on our side may
 * still have made one, so it has no slug yet).
 */
export const WANTS_PACK_SYNC: Filter<StoredBuiltPool> = {
  visibility: { $ne: "private" },
  "pack.gone": { $ne: true },
  $or: [{ "slots.0": { $exists: true } }, { "pack.state": { $ne: "none" } }],
};

/**
 * @function markPackPending
 * @param id {string} a built pool that just changed
 * @returns {Promise<StoredBuiltPool | null>} the pool with its pack marked pending, or null when
 *          it has nothing for packs: it's private, packs' moderators removed its pack, or it's
 *          empty and has no pack yet
 */
export const markPackPending = async (id: string): Promise<StoredBuiltPool | null> =>
  readBuiltPool(
    await (await builtPoolsCollection()).findOneAndUpdate(
      { _id: id, ...WANTS_PACK_SYNC },
      { $set: { "pack.state": "pending" } },
      { returnDocument: "after" },
    ),
  );

/**
 * @function deleteBuiltPool
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} the owner or an admin
 * @returns {Promise<Answer<{ packRemoval: PackRemoval }>>} ok once the pool is gone, with what
 *          happened to its pack (none, removed, or queued because packs couldn't be asked); its
 *          id stays claimed, so it's never handed out again
 */
export const deleteBuiltPool = async (
  id: string,
  caller: Caller,
): Promise<Answer<{ packRemoval: PackRemoval }>> => {
  const loaded = await loadFor(id, caller, (access) => access.canDelete);
  if (!loaded.ok) return loaded;
  const packRemoval = await removePackOrQueue(loaded.value.pool);
  await (await builtPoolsCollection()).deleteOne({ _id: id });
  await deleteActivityOf([id]);
  return { ok: true, value: { packRemoval } };
};

/**
 * @function setBuiltPoolVisibility
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} the owner
 * @param visibility {Visibility} who may see it now
 * @returns {Promise<Answer<{ pool: BuiltPoolView; packRemoval: PackRemoval }>>} the pool
 *          after the change (a new version unless nothing changed) and what happened to its
 *          pack: going private removes it, or queues its removal when packs can't be asked
 */
export const setBuiltPoolVisibility = async (
  id: string,
  caller: Caller,
  visibility: Visibility,
): Promise<Answer<{ pool: BuiltPoolView; packRemoval: PackRemoval }>> => {
  const loaded = await loadFor(id, caller, (access) => access.canManage);
  if (!loaded.ok) return loaded;
  const { pool } = loaded.value;
  if (pool.visibility === visibility) {
    return { ok: true, value: { pool: await viewOf(pool, caller), packRemoval: "none" } };
  }
  const packRemoval = visibility === "private" ? await removePackOrQueue(pool) : "none";
  // packs' 410 stays: a pool packs' moderators removed never syncs again, private or not.
  const pack = visibility === "private" ? { ...EMPTY_BUILT_PACK, gone: pool.pack.gone } : pool.pack;
  const updated = await (await builtPoolsCollection()).findOneAndUpdate(
    { _id: id },
    { $set: { visibility, pack, updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: "after" },
  );
  // Unlisted and public pools' packs follow their visibility.
  const parsed =
    (visibility !== "private" && (await markPackPending(id))) || readBuiltPool(updated);
  if (!parsed) return refuse(404, "not_found", NOT_FOUND);
  await recordFor(caller, id, visibilityActivity(visibility));
  return { ok: true, value: { pool: await viewOf(parsed, caller), packRemoval } };
};

export type PoolListItem = Pick<StoredBuiltPool, "name" | "visibility" | "updatedAt"> & {
  id: string;
  maps: number;
};

export type YourPools = { owned: PoolListItem[]; editing: PoolListItem[] };

const listItem = (pool: StoredBuiltPool): PoolListItem => ({
  id: pool._id,
  name: pool.name,
  visibility: pool.visibility,
  updatedAt: pool.updatedAt,
  maps: pool.slots.length,
});

/**
 * @function listBuiltPoolsFor
 * @param user {Pick<SessionUser, "id" | "osuId">} the signed-in user
 * @returns {Promise<YourPools>} the pools they own and the ones they edit, newest change first
 *          (rows of the wrong shape are left out)
 */
export const listBuiltPoolsFor = async (
  user: Pick<SessionUser, "id" | "osuId">,
): Promise<YourPools> => {
  const pools = await builtPoolsCollection();
  const read = async (filter: Record<string, unknown>) =>
    (await pools.find(filter).sort({ updatedAt: -1 }).limit(MAX_POOLS_PER_OWNER).toArray())
      .map(readBuiltPool)
      .flatMap((pool) => (pool ? [listItem(pool)] : []));
  const [owned, editing] = await Promise.all([
    read({ ownerId: user.id }),
    read({ "editors.osuId": user.osuId }),
  ]);
  return { owned, editing };
};
