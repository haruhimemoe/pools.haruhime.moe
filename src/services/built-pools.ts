/**
 * @file src/services/built-pools.ts
 * @desc Database work for pools built here: reading one (a stored row that doesn't parse is left
 *       out, never shown half-broken), what a caller sees of it (the owner's current osu! name
 *       and every bucket), creating one (at most 50 per owner, a fresh "b-" id claimed in
 *       built_pool_ids so no id is ever reused, maybe copied from a past pool or a built one the
 *       caller can see), changing who sees it, and deleting it. A pool with a pack on packs
 *       loses the pack first (going private, being deleted); if packs can't confirm that, nothing
 *       changes here. Lists a user's pools for their account page. Answers are a value or a
 *       refusal with a status, code and message.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import "server-only";
import { type BucketEntry, bucketsOf, type PoolSlot } from "@haruhimemoe/pool";
import { ObjectId } from "mongodb";
import {
  BUILT_POOL_ID_PATTERN,
  MAX_POOLS_PER_OWNER,
  type Visibility,
} from "@/constants/built-pools";
import { getPacksService, type PacksService } from "@/env";
import type { SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deletePack } from "@/lib/packs-client";
import { builtPoolsCollection } from "@/models/BuiltPool";
import {
  type BuiltEditor,
  type BuiltPack,
  type StoredBuiltPool,
  storedBuiltPoolSchema,
} from "@/schemas/built-pool";
import { type Access, accessOf, type Caller } from "@/utils/built-access";

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

export const EMPTY_PACK: BuiltPack = { state: "none", slug: null, syncedAt: null, error: null };

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
  editors: Omit<BuiltEditor, "userId">[];
  buckets: BucketEntry[];
  slots: PoolSlot[];
  version: number;
  pack: BuiltPack;
  startedFrom: string | null;
  createdAt: Date;
  updatedAt: Date;
  access: Pick<Access, "isOwner" | "isEditor" | "canEdit" | "canManage" | "canDelete">;
};

/**
 * @function findBuiltPool
 * @param id {string} an untrusted built pool id
 * @returns {Promise<StoredBuiltPool | null>} the pool, or null (no such id, or a row that
 *          doesn't parse, which is logged)
 */
export const findBuiltPool = async (id: string): Promise<StoredBuiltPool | null> => {
  if (!BUILT_POOL_ID_PATTERN.test(id)) return null;
  const row = await (await builtPoolsCollection()).findOne({ _id: id });
  if (!row) return null;
  const parsed = storedBuiltPoolSchema.safeParse(row);
  if (parsed.success) return parsed.data;
  console.error(`[built] ${id} doesn't parse`, parsed.error.issues[0]?.message);
  return null;
};

/**
 * @function toStored
 * @param pool {StoredBuiltPool} a pool about to be written
 * @returns {StoredBuiltPool} the same pool, checked, with `buckets` left out for the default
 *          list (the driver would store an undefined value as null)
 * @throws {z.ZodError} when it doesn't satisfy the stored schema (a bug)
 */
export const toStored = (pool: StoredBuiltPool): StoredBuiltPool => {
  const { buckets, ...rest } = storedBuiltPoolSchema.parse(pool);
  return buckets === undefined ? rest : { ...rest, buckets };
};

const ownerOf = async (ownerId: string): Promise<BuiltPoolView["owner"]> => {
  if (!ObjectId.isValid(ownerId)) return null;
  const user = await getDb()
    .collection("user")
    .findOne({ _id: new ObjectId(ownerId) }, { projection: { osuId: 1, username: 1 } });
  return typeof user?.osuId === "number" && typeof user.username === "string"
    ? { osuId: user.osuId, username: user.username }
    : null;
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
    editors: pool.editors.map(({ osuId, username, addedAt }) => ({ osuId, username, addedAt })),
    buckets: bucketsOf(pool).map((entry) => ({ ...entry })),
    slots: pool.slots,
    version: pool.version,
    pack: pool.pack,
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
 * @function removePackOf
 * @param pool {Pick<StoredBuiltPool, "_id" | "pack">} a pool
 * @returns {Promise<Answer<null>>} ok once packs has no pack for it (or it never had one); 502
 *          when packs couldn't confirm that
 */
export const removePackOf = async (
  pool: Pick<StoredBuiltPool, "_id" | "pack">,
): Promise<Answer<null>> => {
  if (pool.pack.state === "none") return { ok: true, value: null };
  const failed = (why: string) =>
    refuse(502, "pack_not_removed", `Couldn't remove this pool's pack on packs: ${why}`);
  let service: PacksService | null;
  try {
    service = getPacksService();
  } catch (error) {
    return failed(error instanceof Error ? error.message : "packs isn't set up.");
  }
  if (!service) return failed("packs isn't set up here.");
  const answer = await deletePack(service, pool._id);
  return answer.kind === "ok" ? { ok: true, value: null } : failed(answer.message);
};

/**
 * @function deleteBuiltPool
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} the owner or an admin
 * @returns {Promise<Answer<null>>} ok once the pool (and its pack) are gone; its id stays
 *          claimed, so it's never handed out again
 */
export const deleteBuiltPool = async (id: string, caller: Caller): Promise<Answer<null>> => {
  const loaded = await loadFor(id, caller, (access) => access.canDelete);
  if (!loaded.ok) return loaded;
  const removed = await removePackOf(loaded.value.pool);
  if (!removed.ok) return removed;
  await (await builtPoolsCollection()).deleteOne({ _id: id });
  return { ok: true, value: null };
};

/**
 * @function setBuiltPoolVisibility
 * @param id {string} an untrusted built pool id
 * @param caller {Caller} the owner
 * @param visibility {Visibility} who may see it now
 * @returns {Promise<Answer<BuiltPoolView>>} the pool after the change (a new version unless
 *          nothing changed); going private removes its pack first
 */
export const setBuiltPoolVisibility = async (
  id: string,
  caller: Caller,
  visibility: Visibility,
): Promise<Answer<BuiltPoolView>> => {
  const loaded = await loadFor(id, caller, (access) => access.canManage);
  if (!loaded.ok) return loaded;
  const { pool } = loaded.value;
  if (pool.visibility === visibility) return { ok: true, value: await viewOf(pool, caller) };
  if (visibility === "private") {
    const removed = await removePackOf(pool);
    if (!removed.ok) return removed;
  }
  const pack = visibility === "private" ? EMPTY_PACK : pool.pack;
  const updated = await (await builtPoolsCollection()).findOneAndUpdate(
    { _id: id },
    { $set: { visibility, pack, updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: "after" },
  );
  const parsed = storedBuiltPoolSchema.safeParse(updated);
  if (!parsed.success) return refuse(404, "not_found", NOT_FOUND);
  return { ok: true, value: await viewOf(parsed.data, caller) };
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
 *          (rows that don't parse are left out)
 */
export const listBuiltPoolsFor = async (
  user: Pick<SessionUser, "id" | "osuId">,
): Promise<YourPools> => {
  const pools = await builtPoolsCollection();
  const read = async (filter: Record<string, unknown>) =>
    (await pools.find(filter).sort({ updatedAt: -1 }).limit(MAX_POOLS_PER_OWNER).toArray())
      .map((row) => storedBuiltPoolSchema.safeParse(row))
      .flatMap((parsed) => (parsed.success ? [listItem(parsed.data)] : []));
  const [owned, editing] = await Promise.all([
    read({ ownerId: user.id }),
    read({ "editors.osuId": user.osuId }),
  ]);
  return { owned, editing };
};
